import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const DOCS = {
  terms: {
    title: 'Terms of Use',
    intro: 'Please read these terms before creating your CourtConnect account.',
    agreeLabel: 'I have read and agree',
    sections: [
      {
        heading: '1. About CourtConnect',
        body: 'CourtConnect is an online reservation system for the barangay courts of San Juan City. By creating an account, you agree to these terms.',
      },
      {
        heading: '2. Your account',
        body: 'Give accurate information and a valid email address, since we verify it with a one-time code. Keep your password private. You are responsible for everything done through your account.',
      },
      {
        heading: '3. Making reservations',
        body: 'Each reservation is a 2-hour slot between 8:00 AM and 10:00 PM. You may hold up to 2 pending or approved reservations per week. Requests are first come, first served: if two residents ask for the same slot, the earlier request is kept. New reservations stay pending until a barangay admin approves them. Please choose the activity honestly.',
      },
      {
        heading: '4. Cancellations and the waitlist',
        body: 'You can cancel from My Reservations at any time so others can use the slot. If a slot is taken, you can join its waitlist. When the slot opens up, the next resident in line may automatically receive a pending reservation for it, as long as they are within the weekly limit.',
      },
      {
        heading: '5. Arriving on time',
        body: 'Please be at the court at your start time. An admin may mark a reservation as a no-show 15 minutes after the start time. No-shows are recorded on your account, and repeated no-shows may lead to limits on future bookings at the barangay\'s discretion.',
      },
      {
        heading: '6. Public events',
        body: 'If you mark a reservation as a public event, its title, description, court, time, and your name become visible to other residents.',
      },
      {
        heading: '7. Court rules and changes',
        body: 'Follow the posted barangay court rules. Admins may reject or cancel a reservation for maintenance, official barangay activities, safety, or misuse of the system.',
      },
      {
        heading: '8. Acceptable use',
        body: 'Do not give false information, book slots you do not plan to use, or try to disrupt or bypass the system. Accounts that break these rules may be restricted or removed.',
      },
      {
        heading: '9. Changes to these terms',
        body: 'These terms may be updated from time to time. Continuing to use CourtConnect means you accept the updated terms.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Notice',
    intro: 'This explains what personal information CourtConnect collects and how it is used.',
    agreeLabel: 'I have read and acknowledge',
    sections: [
      {
        heading: '1. What we collect',
        body: 'Your name, email address, and password (stored in scrambled form, never in readable form). If you add one, your profile photo. We also keep your reservation history (courts, dates, times, activity, and status), any no-show records, and your in-app notifications.',
      },
      {
        heading: '2. Why we collect it',
        body: 'To create and secure your account, verify your email with a one-time code, process and manage your reservations, send you updates about them, and keep records and usage statistics for the barangay.',
      },
      {
        heading: '3. Who can see it',
        body: 'Barangay admins can see reservations along with the name and email of the resident who made them. Other residents only see your name and the event details if you mark a reservation as public.',
      },
      {
        heading: '4. Services we use',
        body: 'An email delivery service sends verification codes and notices. A cloud storage service holds profile photos. Hosting providers run the system. Statistics summaries shown to admins are written by an AI service using combined counts only, never names or emails.',
      },
      {
        heading: '5. How long we keep it',
        body: 'For as long as your account is active and as needed for barangay records. You can ask the barangay office to delete your account.',
      },
      {
        heading: '6. Your rights',
        body: 'Under the Data Privacy Act of 2012 (RA 10173), you may ask to see, correct, or delete your personal information. Please contact the barangay office to make a request.',
      },
      {
        heading: '7. Security',
        body: 'Access to resident information is limited to barangay admins, and passwords are stored in scrambled form. No online system can promise perfect security, so please keep your password private.',
      },
    ],
  },
};

// A real popup agreement: the agree button only unlocks after the reader scrolls to the end
function LegalDialog({ doc, onAgree, onClose }) {
  const [reachedEnd, setReachedEnd] = useState(false);
  const content = DOCS[doc];

  function checkEnd(el) {
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= 8) setReachedEnd(true);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
          <DialogDescription>{content.intro}</DialogDescription>
        </DialogHeader>

        <div
          ref={(el) => el && checkEnd(el)}
          onScroll={(e) => checkEnd(e.currentTarget)}
          className="max-h-[50vh] overflow-y-auto pr-2 space-y-4"
        >
          {content.sections.map((section) => (
            <div key={section.heading}>
              <h4 className="font-medium text-foreground">{section.heading}</h4>
              <p className="text-muted-foreground mt-1 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>

        <DialogFooter className="items-center">
          {!reachedEnd && (
            <p className="text-xs text-muted-foreground sm:mr-auto">Scroll to the bottom to continue</p>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onAgree} disabled={!reachedEnd}>
            {content.agreeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LegalDialog;