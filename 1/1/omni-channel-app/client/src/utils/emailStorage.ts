interface ReadEmailsStore {
  [emailId: string]: boolean;
}

export const markEmailAsRead = (emailId: string) => {
  const readEmails = localStorage.getItem('readEmails');
  const readEmailsObj: ReadEmailsStore = readEmails ? JSON.parse(readEmails) : {};
  readEmailsObj[emailId] = true;
  localStorage.setItem('readEmails', JSON.stringify(readEmailsObj));
};

export const isEmailRead = (emailId: string): boolean => {
  const readEmails = localStorage.getItem('readEmails');
  const readEmailsObj: ReadEmailsStore = readEmails ? JSON.parse(readEmails) : {};
  return !!readEmailsObj[emailId];
}; 