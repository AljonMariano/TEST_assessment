import React from 'react';
import {
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Typography,
    Divider,
    Box
} from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';

interface Conversation {
    phoneNumber: string;
    lastMessage: string;
    timestamp: string;
}

interface ConversationListProps {
    conversations: Conversation[];
    selectedNumber: string | null;
    onSelectConversation: (phoneNumber: string) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
    conversations,
    selectedNumber,
    onSelectConversation
}) => {
    return (
        <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
            {conversations.map((conv) => (
                <React.Fragment key={conv.phoneNumber}>
                    <ListItem 
                        alignItems="flex-start"
                        button
                        selected={selectedNumber === conv.phoneNumber}
                        onClick={() => onSelectConversation(conv.phoneNumber)}
                    >
                        <ListItemAvatar>
                            <Avatar>
                                <PersonIcon />
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                            primary={conv.phoneNumber}
                            secondary={
                                <React.Fragment>
                                    <Typography
                                        sx={{ display: 'inline' }}
                                        component="span"
                                        variant="body2"
                                        color="text.primary"
                                    >
                                        {conv.lastMessage}
                                    </Typography>
                                    <Box component="span" sx={{ float: 'right', fontSize: '0.8rem' }}>
                                        {new Date(conv.timestamp).toLocaleTimeString([], { 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                        })}
                                    </Box>
                                </React.Fragment>
                            }
                        />
                    </ListItem>
                    <Divider variant="inset" component="li" />
                </React.Fragment>
            ))}
        </List>
    );
};

export default ConversationList; 