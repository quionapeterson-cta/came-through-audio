-- A pre-signed packet is the company's half of the signature only: it is still waiting on the recipient. The first
-- send path wrote such a packet as 'completed', so the admin list said "Fully executed" before the invitee had opened
-- it. Sending now always starts at 'sent'; this repairs the rows the old path left behind.
update public.pdf_packets
set status = 'sent',
    completed_at = null
where status = 'completed'
  and recipient_signed_at is null;
