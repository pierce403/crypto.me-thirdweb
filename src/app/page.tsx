"use client";

import { createThirdwebClient } from "thirdweb";
import { ThirdwebProvider, ConnectButton } from "thirdweb/react";
import { useState } from "react";
import Image from 'next/image';

type ProfileData = {
  ensName: string;
  avatar: string;
  farcasterStats: {
    followers: number;
    following: number;
    posts: number;
  };
};

// Replace with your actual client ID
const clientId = "YOUR_CLIENT_ID_HERE";

const client = createThirdwebClient({ clientId });

// Mock data for popular profiles
const popularProfiles = [
  { id: 1, name: 'vitalik.eth', avatar: `https://www.gravatar.com/avatar/${Buffer.from('vitalik.eth').toString('hex')}?d=identicon&s=200` },
  { id: 2, name: 'satoshi.eth', avatar: `https://www.gravatar.com/avatar/${Buffer.from('satoshi.eth').toString('hex')}?d=identicon&s=200` },
  { id: 3, name: 'cryptopunk.eth', avatar: `https://www.gravatar.com/avatar/${Buffer.from('cryptopunk.eth').toString('hex')}?d=identicon&s=200` },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfileData, setEditedProfileData] = useState<ProfileData | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Searching for:", searchQuery);
    try {
      const response = await fetch(`http://127.0.0.1:8000/profile/${searchQuery}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setProfileData({
        ensName: data.ens_name,
        avatar: data.avatar,
        farcasterStats: data.farcaster_stats
      });
      setEditedProfileData({
        ensName: data.ens_name,
        avatar: data.avatar,
        farcasterStats: data.farcaster_stats
      });
    } catch (error) {
      console.error("Error fetching profile data:", error);
      // Handle error (e.g., show error message to user)
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editedProfileData) return;
    try {
      const response = await fetch(`http://127.0.0.1:8000/profile/${editedProfileData.ensName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedProfileData),
      });
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      const updatedData = await response.json();
      setProfileData(updatedData.profile);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      // Handle error (e.g., show error message to user)
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedProfileData(prev => prev ? { ...prev, [name]: value } : null);
  };

  return (
    <ThirdwebProvider clientId={clientId}>
      <div className="grid grid-rows-[auto_1fr_auto] min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
        <header className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">crypto.me</h1>
          <ConnectButton client={client} />
        </header>

        <main className="flex flex-col gap-8">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by address or ENS name"
              className="flex-grow border border-gray-300 rounded px-4 py-2"
            />
            <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition-colors">
              Search
            </button>
          </form>

          {profileData && (
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">{profileData.ensName}</h2>
              <div className="flex items-center gap-4 mb-4">
                <Image
                  src={profileData.avatar}
                  alt={profileData.ensName}
                  width={100}
                  height={100}
                  className="rounded-full"
                />
                <div>
                  <h3 className="text-xl font-semibold">Farcaster Stats</h3>
                  <p>Followers: {profileData.farcasterStats?.followers ?? 'N/A'}</p>
                  <p>Following: {profileData.farcasterStats?.following ?? 'N/A'}</p>
                  <p>Posts: {profileData.farcasterStats?.posts ?? 'N/A'}</p>
                </div>
              </div>
              {isEditing ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="mt-4">
                  <div className="mb-4">
                    <label htmlFor="ensName" className="block text-sm font-medium text-gray-700">ENS Name</label>
                    <input
                      type="text"
                      id="ensName"
                      name="ensName"
                      value={editedProfileData?.ensName || ''}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors">Save</button>
                </form>
              ) : (
                <button onClick={handleEdit} className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors">Edit Profile</button>
              )}
            </div>
          )}

          <section>
            <h2 className="text-2xl font-bold mb-4">Popular Profiles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {popularProfiles.map(profile => (
                <div key={profile.id} className="bg-white shadow-md rounded-lg p-4 flex items-center gap-4">
                  <Image src={profile.avatar} alt={profile.name} width={50} height={50} className="rounded-full" />
                  <span className="font-semibold">{profile.name}</span>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="flex gap-6 flex-wrap items-center justify-center text-sm text-gray-600">
          <a href="#" className="hover:underline">About</a>
          <a href="#" className="hover:underline">Privacy Policy</a>
          <a href="#" className="hover:underline">Terms of Service</a>
          <p>&copy; 2024 crypto.me. All rights reserved.</p>
        </footer>
      </div>
    </ThirdwebProvider>
  );
}
