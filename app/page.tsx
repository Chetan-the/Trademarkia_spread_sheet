"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Plus,
  LogOut,
  Loader2,
  Clock,
} from "lucide-react";

interface SpreadsheetDoc {
  id: string;
  title: string;
  ownerId: string;
  authorName: string;
  createdAt: any;
  updatedAt: any;
}

/* ⭐ Helper to show time like "2m ago" */
function getTimeAgo(timestamp: any) {
  if (!timestamp?.toDate) return "Just now";

  const now = Date.now();
  const updated = timestamp.toDate().getTime();
  const diff = Math.floor((now - updated) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  return timestamp.toDate().toLocaleDateString();
}

export default function Home() {
  const { user, login, logout, loading } = useAuth();
  const [docs, setDocs] = useState<SpreadsheetDoc[]>([]);
  const [creating, setCreating] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [docTitle, setDocTitle] = useState("");

  const router = useRouter();

  useEffect(() => {
    if (!user) {
      setDocs([]);
      return;
    }

    const q = query(
      collection(db, "documents"),
      where("ownerId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const documents: SpreadsheetDoc[] = [];

      snapshot.forEach((doc) => {
        documents.push({
          id: doc.id,
          ...(doc.data() as any),
        });
      });

      setDocs(documents);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateDocument = async () => {
    if (!user || !docTitle.trim()) return;

    setCreating(true);

    try {
      const docRef = await addDoc(collection(db, "documents"), {
        title: docTitle,
        ownerId: user.uid,
        authorName: user.displayName || "Unknown",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setShowModal(false);
      setDocTitle("");

      router.push(`/doc/${docRef.id}`);
    } catch (error) {
      console.error("Error creating document:", error);
    }

    setCreating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="p-10 bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full text-center space-y-8">
          <div className="flex flex-col items-center space-y-3">
            <div className="p-4 bg-blue-100 rounded-full">
              <FileSpreadsheet className="w-10 h-10 text-blue-600" />
            </div>

            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              Spread Sheets Testing
            </h1>

            <p className="text-gray-500 text-sm">
              Lightweight, real-time collaboration
            </p>
          </div>

          <button
            onClick={async () => {
              await login();

              const redirect = localStorage.getItem("redirectAfterLogin");

              if (redirect) {
                localStorage.removeItem("redirectAfterLogin");
                router.push(redirect);
              }
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => router.push("/")}
          >
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            </div>

            <span className="text-xl font-semibold">Sheets</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 pr-4 border-r">
              <span className="text-sm font-medium hidden sm:block">
                {user.displayName}
              </span>

              {user.photoURL && (
                <img
                  src={user.photoURL}
                  className="w-8 h-8 rounded-full"
                />
              )}
            </div>

            <button
              onClick={logout}
              className="p-2 text-gray-500 hover:text-red-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-6xl mx-auto px-6 py-8">

        <div className="flex justify-between mb-8">
          <h2 className="text-2xl font-semibold">
            Recent Spreadsheets
          </h2>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl"
          >
            <Plus className="w-5 h-5" />
            New Blank
          </button>
        </div>

        {docs.length === 0 ? (
          <div className="bg-white border border-dashed p-16 text-center rounded-2xl">

            <FileSpreadsheet className="w-10 h-10 mx-auto text-gray-400" />

            <h3 className="text-lg mt-3 font-medium">
              No spreadsheets yet
            </h3>

            <p className="text-gray-500">
              Create your first spreadsheet
            </p>

            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-blue-600 hover:underline"
            >
              Create a spreadsheet
            </button>

          </div>
        ) : (

          <div className="grid grid-cols-4 gap-6">

            {docs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => router.push(`/doc/${doc.id}`)}
                className="bg-white rounded-xl border hover:shadow-lg cursor-pointer"
              >

                <div className="h-32 flex items-center justify-center bg-gray-50">
                  <FileSpreadsheet className="w-12 h-12 text-blue-200" />
                </div>

                <div className="p-4">

                  <h3 className="font-medium truncate">
                    {doc.title}
                  </h3>

                  <div className="text-xs text-gray-500 mt-2 space-y-1">

                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getTimeAgo(doc.updatedAt)}
                    </div>

                    <div className="text-gray-400">
                      Author: {doc.authorName}
                    </div>

                  </div>

                </div>

              </div>
            ))}

          </div>

        )}
      </main>

      {/* CREATE DOCUMENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">

          <div className="bg-white rounded-xl shadow-lg p-6 w-96 space-y-4">

            <h2 className="text-lg font-semibold">
              Create Spreadsheet
            </h2>

            <input
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="Spreadsheet name"
              className="w-full border px-3 py-2 rounded-lg"
            />

            <div className="flex justify-end gap-3">

              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600"
              >
                Cancel
              </button>

              <button
                onClick={handleCreateDocument}
                disabled={creating}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                {creating && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Create
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}