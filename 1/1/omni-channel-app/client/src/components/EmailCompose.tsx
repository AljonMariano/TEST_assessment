import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  IconButton,
  Typography
} from '@mui/material';
import { AttachFile as AttachFileIcon } from '@mui/icons-material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const API_URL = 'http://localhost:5005/api';

interface EmailComposeProps {
  open: boolean;
  onClose: () => void;
  onSend: () => void;
}

interface Attachment {
  file: File;
  preview?: string;
}

const EmailCompose = ({ open, onClose, onSend }: EmailComposeProps) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const newAttachments = files.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('body', body);
    attachments.forEach(attachment => {
      formData.append('attachments', attachment.file);
    });

    try {
      const response = await fetch(`${API_URL}/emails/send`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        onSend();
        onClose();
        setTo('');
        setSubject('');
        setBody('');
        setAttachments([]);
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'image'],
      ['clean']
    ],
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Compose Email</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="To"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              fullWidth
              required
            />
            
            <Box sx={{ height: 300 }}>
              <ReactQuill
                theme="snow"
                value={body}
                onChange={setBody}
                modules={modules}
                style={{ height: '250px' }}
              />
            </Box>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              multiple
            />
            
            <Box>
              <Button
                startIcon={<AttachFileIcon />}
                onClick={handleAttachmentClick}
                variant="outlined"
              >
                Attach Files
              </Button>
            </Box>

            {attachments.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Attachments:
                </Typography>
                {attachments.map((attachment, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1
                    }}
                  >
                    {attachment.preview ? (
                      <img
                        src={attachment.preview}
                        alt="preview"
                        style={{ width: 50, height: 50, objectFit: 'cover' }}
                      />
                    ) : (
                      <AttachFileIcon />
                    )}
                    <Typography>{attachment.file.name}</Typography>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => removeAttachment(index)}
                    >
                      Remove
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Send</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EmailCompose; 