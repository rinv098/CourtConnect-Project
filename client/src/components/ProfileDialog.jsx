import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

function ProfileDialog({ open, onOpenChange, onUpdated }) {
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Sync state with localStorage whenever the dialog opens
  useEffect(() => {
    if (open) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setName(user.name || '');
      setAvatarUrl(user.avatar_url || '');
      setError('');
    }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, avatarUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update profile');
        return;
      }

      localStorage.setItem('user', JSON.stringify(data.user));
      onUpdated?.(data.user);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setError('Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>{(name || '?').charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatarUrl">Profile Picture</Label>
            <Input 
              type="file" 
              accept="image/*" 
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const formData = new FormData();
                formData.append('avatar', file);
                const token = localStorage.getItem('token');

                try {
                  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/profile/avatar`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                  });

                  const data = await response.json();

                  if (response.ok) {
                    // Update immediate preview state
                    setAvatarUrl(data.avatarUrl);

                    // Persist updated avatar URL directly to localStorage
                    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                    const updatedUser = { ...currentUser, avatar_url: data.avatarUrl };
                    localStorage.setItem('user', JSON.stringify(updatedUser));

                    // Trigger parent layout update immediately
                    onUpdated?.(updatedUser);
                  } else {
                    setError(data.error || 'Failed to upload avatar');
                  }
                } catch (err) {
                  console.error(err);
                  setError('Failed to upload image.');
                }
              }} 
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ProfileDialog;