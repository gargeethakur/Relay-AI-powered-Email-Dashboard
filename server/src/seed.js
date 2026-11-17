// Realistic sample mailboxes used to simulate Gmail / Outlook synchronisation.
const P = (name, email) => ({ name, email });
const ME = P('Alexandra Reyes', 'alexandra@reyesgroup.com');
const inMsg = (from, hoursAgo, body) => ({ dir: 'in', from, hoursAgo, body });
const outMsg = (by, hoursAgo, body) => ({ dir: 'out', from: ME, by, hoursAgo, body });

export const SAMPLE = {
  gmail: [
    { subject: 'Can we move Thursday\'s leadership sync?', unread: true, messages: [
      inMsg(P('Priya Nair', 'priya.nair@halcyon.io'), 5, 'Hi Alexandra, I have a conflict with our leadership sync on Thursday at 3:00 PM. Are you available Friday at 11:00 AM or Monday at 2:00 PM instead? Could someone confirm the new time and send an updated invite?')] },
    { subject: 'Board resolution — approval needed by Friday', unread: true, messages: [
      inMsg(P('Marcus Hale', 'marcus.hale@reyesgroup.com'), 3, 'Alexandra, the board resolution on the Series B allocation is ready for your sign-off. This is confidential, so please review the attached draft yourself and approve by Friday. Counsel has flagged section 4.2 as needing your decision.')] },
    { subject: 'Singapore trip: itinerary and seat preferences', unread: true, messages: [
      inMsg(P('Meridian Travel', 'bookings@meridiantravel.com'), 8, 'Your itinerary for Singapore on Nov 24 is attached. Flight departs 9:40 am. Could you confirm seat preference and dietary requirements by Wednesday so we can finalise the booking?')] },
    { subject: 'Product Weekly: what shipped in November', unread: false, messages: [
      inMsg(P('Halcyon Product', 'noreply@halcyon.io'), 20, 'Your weekly digest of product updates. This newsletter is sent automatically. Unsubscribe at any time.')] },
    { subject: 'Invoice #4821 from Studio Bloom', unread: true, messages: [
      inMsg(P('Studio Bloom Billing', 'accounts@studiobloom.co'), 30, 'Please find attached invoice #4821 for the Q4 brand refresh. Payment is due Nov 25. Let us know if you need a purchase order reference added.')] },
    { subject: 'Intro: Alexandra <> Daniel Okafor', unread: true, messages: [
      inMsg(P('Helen Frost', 'helen@frostcapital.com'), 26, 'Alexandra, I would love to introduce you to Daniel Okafor, a partner at Okafor Ventures who is keen on your Series B. Would you be open to a call? I think your personal input on timing would help him a lot.')] },
    { subject: 'Re: Northwind contract renewal', unread: true, messages: [
      inMsg(P('Tom Becker', 'tom.becker@northwind.com'), 96, 'Hi Alexandra, ahead of the contract renewal, could we discuss pricing for the next term?'),
      outMsg('client', 90, 'Thanks Tom. Happy to talk. I want to keep the current rate card, will share my thinking soon.'),
      inMsg(P('Tom Becker', 'tom.becker@northwind.com'), 14, 'Thanks, understood. We have attached a revised proposal with a 6% uplift. Let me know your thoughts.')] },
    { subject: 'Dinner Friday?', unread: true, messages: [
      inMsg(P('Sam Reyes', 'sam.reyes@gmail.com'), 2, 'Hey! Are you free for dinner on Friday? Mum is in town and would love to catch up with you.')] },
    { subject: 'Your Uber receipt', unread: false, messages: [
      inMsg(P('Uber Receipts', 'receipts@uber.com'), 40, 'Thanks for riding, Alexandra. Your receipt for the trip on Nov 13 is attached. This is an automated message.')] },
    { subject: 'FutureOps 2027 — speaker invitation', unread: true, messages: [
      inMsg(P('Lena Ortiz', 'lena@futureops.org'), 12, 'Hello, would you be open to delivering the opening keynote at FutureOps on March 4? If so, could someone send over a short bio and your AV requirements?')] },
    { subject: 'Catering quote for December offsite', unread: false, messages: [
      inMsg(P('Fork & Co Catering', 'hello@forkandco.com'), 60, 'Thanks for your enquiry. We can cater the Dec 12 offsite. Please tell us your headcount and we will send the final quote.'),
      outMsg('assistant', 28, 'Hi, headcount is 24 including dietary needs (6 vegetarian, 2 gluten-free). Could you send the final quote?')] },
  ],
  outlook: [
    { subject: 'Team offsite planning — December 12', unread: true, messages: [
      inMsg(P('Nadia Cole', 'nadia.cole@reyesgroup.com'), 6, 'Hi, we are locking in the venue for the team offsite on Dec 12. Could you confirm the calendar hold and RSVP for the evening dinner?')] },
    { subject: 'Performance review — your input requested', unread: true, messages: [
      inMsg(P('Jordan Pike', 'jordan.pike@reyesgroup.com'), 10, 'Alexandra, I need your input on the performance review for the Head of Growth. Your personal feedback is required before HR closes the cycle on Friday.')] },
    { subject: 'Security alert: new sign-in', unread: false, messages: [
      inMsg(P('Microsoft Account', 'account-security-noreply@microsoft.com'), 36, 'A new sign-in to your account was detected. If this was you, no further action is needed. This is an automated security alert.')] },
    { subject: 'Q4 budget review: deck for Wednesday', unread: true, messages: [
      inMsg(P('Elena Ward', 'elena.ward@reyesgroup.com'), 9, 'Hi Alexandra, the Q4 budget deck is ready. Please review and confirm your numbers before our meeting on Wednesday at 2:00 PM. I need your decision on the marketing allocation.')] },
    { subject: 'Dental appointment reminder', unread: true, messages: [
      inMsg(P('Bright Smile Dental', 'reception@brightsmile.com'), 18, 'This is a reminder of your appointment on Thursday at 8:30 AM. Please reply to confirm or call us to reschedule.')] },
    { subject: 'Re: Conference booth — all sorted', unread: false, messages: [
      inMsg(P('Rafael Mendes', 'rafael@expohub.com'), 50, 'Booth payment received and the layout is approved. Thanks, all sorted on our side, no further action needed.')], completed: true },
  ],
};
