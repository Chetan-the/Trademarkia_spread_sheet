"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "@/lib/firebase";
import { arrayUnion } from "firebase/firestore";
import {
  collection, doc, getDoc, updateDoc,
  onSnapshot, query, where, writeBatch, serverTimestamp, setDoc, deleteDoc
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { evaluateFormula, indexToColLetter } from "@/lib/formula";
import { ArrowLeft, Loader2, Save, Users, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface CellData {
  value: string;
  computedValue?: string | number;
  lastModifiedBy?: string;
  row: number;
  col: number;
}

interface ViewerData {
  userId: string;
  sessionId: string;
  name: string;
  color: string;
  docId: string;
  currentCell: string | null;
  lastActive: any;
}

const ROWS = 50;
const COLS = 26;
const PRESENCE_TIMEOUT_MS = 60000;

const USER_COLORS = [
  "#f87171", "#fb923c", "#fbbf24", "#34d399", "#2dd4bf",
  "#38bdf8", "#818cf8", "#a78bfa", "#e879f9", "#fb7185"
];

function getFormulaDeps(value: string): string[] {
  if (!value.startsWith("=")) return [];
  const deps = [];
  const cellRefRegex = /[A-Z]+[0-9]+/g;
  let match;
  while ((match = cellRefRegex.exec(value)) !== null) {
    deps.push(match[0]);
  }
  return deps;
}

export default function Spreadsheet({ docId }: { docId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!user) {
      localStorage.setItem("redirectAfterLogin", window.location.pathname);
      router.push("/");
    }
  }, [user, router]);
  const [docMeta, setDocMeta] = useState<any>(null);
  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [viewers, setViewers] = useState<Record<string, ViewerData>>({});
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState("")

  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [formulaBarValue, setFormulaBarValue] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [myColor] = useState(() => USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]);
  const [copied, setCopied] = useState(false);
  const alreadySaved = docMeta?.savedBy?.includes(user?.uid)
  const inputRef = useRef<HTMLInputElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const cellsRef = useRef<Record<string, CellData>>({});

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    if (editingCell) {
      setFormulaBarValue(editValue);
    } else if (activeCell) {
      setFormulaBarValue(cells[activeCell]?.value || "");
    } else {
      setFormulaBarValue("");
    }
  }, [activeCell, editingCell, editValue, cells]);

  useEffect(() => {
    if (!docId) return;
    getDoc(doc(db, "documents", docId)).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setDocMeta(data);
        setTitleValue(data.title || "");
      }
    });

    const cellsQuery = query(collection(db, "cells"), where("docId", "==", docId));
    const unsubCells = onSnapshot(cellsQuery, (snapshot) => {
      const newCells: Record<string, CellData> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.row && data.col != null) {
          const id = `${indexToColLetter(data.col - 1)}${data.row}`;
          newCells[id] = data as CellData;
        }
      });
      setCells((prev) => ({ ...prev, ...newCells }));
      setIsSaving(false);
    }, (error) => console.error("Cells snapshot error", error));

    const presenceQuery = query(collection(db, "presence"), where("docId", "==", docId));
    const unsubPresence = onSnapshot(presenceQuery, (snapshot) => {
      const activeViewers: Record<string, ViewerData> = {};
      const now = Date.now();

      snapshot.forEach(docSnap => {
        const data = docSnap.data() as ViewerData;
        const lastActiveMs = data.lastActive?.toMillis?.() || 0;
        if (now - lastActiveMs < PRESENCE_TIMEOUT_MS) {
          activeViewers[docSnap.id] = data;
        }
      });
      setViewers(activeViewers);
    }, (error) => console.error("Presence snapshot error", error));

    return () => {
      unsubCells();
      unsubPresence();
    };
  }, [docId]);

  useEffect(() => {
    if (!user || !docId) return;
    const presenceDocId = `${user.uid}_${sessionId}`;
    const myPresenceRef = doc(db, "presence", presenceDocId);

    const updatePresence = () => {
      setDoc(myPresenceRef, {
        userId: user.uid,
        sessionId: sessionId,
        name: user.displayName || "Anonymous",
        color: myColor,
        docId: docId,
        currentCell: activeCell || null,
        lastActive: serverTimestamp()
      }, { merge: true }).catch(console.error);
    };

    updatePresence();
    const interval = setInterval(updatePresence, 20000);

    return () => {
      clearInterval(interval);
      deleteDoc(myPresenceRef).catch(console.error);
    };
  }, [user, docId, activeCell, myColor, sessionId]);

  const getCellValue = useCallback((id: string) => {
    return cellsRef.current[id]?.value || "";
  }, []);

  const handleCellClick = (cellId: string) => {
    if (editingCell === cellId) return;
    if (editingCell) commitCell(editingCell, editValue);
    setActiveCell(cellId);
    setEditingCell(null);
  };

  const handleCellDoubleClick = (cellId: string) => {
    setActiveCell(cellId);
    setEditingCell(cellId);
    setEditValue(cells[cellId]?.value || "");
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent, cellId: string) => {
    if (editingCell) {
      if (e.key === "Enter") {
        e.preventDefault();
        commitCell(cellId, editValue);
        const match = cellId.match(/([A-Z]+)([0-9]+)/);
        if (match) {
          const nextRow = parseInt(match[2]) + 1;
          if (nextRow <= ROWS) setActiveCell(`${match[1]}${nextRow}`);
        }
      } else if (e.key === "Escape") {
        setEditingCell(null);
        setActiveCell(cellId);
      }
      return;
    }

    if (!editingCell && activeCell === cellId) {
      const match = cellId.match(/([A-Z]+)([0-9]+)/);
      if (!match) return;
      const col = match[1];
      const row = parseInt(match[2]);

      if (e.key === "Enter") {
        e.preventDefault();
        setEditingCell(cellId);
        setEditValue(cells[cellId]?.value || "");
        setTimeout(() => inputRef.current?.focus(), 10);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        commitCell(cellId, "");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (row < ROWS) setActiveCell(`${col}${row + 1}`);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (row > 1) setActiveCell(`${col}${row - 1}`);
      } else if (e.key === "ArrowRight" || e.key === "Tab") {
        e.preventDefault();
        const colIdx = getColIndex(col);
        if (colIdx < COLS - 1) setActiveCell(`${indexToColLetter(colIdx + 1)}${row}`);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const colIdx = getColIndex(col);
        if (colIdx > 0) setActiveCell(`${indexToColLetter(colIdx - 1)}${row}`);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        setEditingCell(cellId);
        setEditValue(e.key);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
    }
  };

  const commitCell = async (cellId: string, value: string) => {
    setEditingCell(null);
    const prevValue = cells[cellId]?.value || "";
    if (prevValue === value) return; // No change

    setIsSaving(true);

    let computedValue: string | number = value;
    if (value.startsWith("=")) {
      const tempGetVal = (id: string) => id === cellId ? value : getCellValue(id);
      computedValue = evaluateFormula(value, tempGetVal, new Set());
    }

    const match = cellId.match(/([A-Z]+)([0-9]+)/);
    const colIdx = match ? getColIndex(match[1]) + 1 : 1;
    const rowIdx = match ? parseInt(match[2]) : 1;

    const batch = writeBatch(db);

    const targetRef = doc(db, `cells/${docId}_${rowIdx}_${colIdx}`);
    batch.set(targetRef, {
      docId,
      row: rowIdx,
      col: colIdx,
      value,
      computedValue: String(computedValue),
      lastModifiedBy: user?.uid || "anonymous"
    });

    const newCells = { ...cellsRef.current };
    newCells[cellId] = {
      row: rowIdx, col: colIdx,
      value,
      computedValue: String(computedValue),
      lastModifiedBy: user?.uid,
    };

    Object.keys(newCells).forEach((id) => {
      if (id !== cellId) {
        const cellData = newCells[id];
        if (cellData.value && cellData.value.startsWith("=")) {
          const tempGetVal = (depId: string) => depId === cellId ? value : (newCells[depId]?.computedValue ?? newCells[depId]?.value ?? "");
          const newComp = evaluateFormula(cellData.value, tempGetVal, new Set());
          if (String(newComp) !== String(cellData.computedValue)) {
            newCells[id] = { ...cellData, computedValue: String(newComp) };
            const depRef = doc(db, `cells/${docId}_${cellData.row}_${cellData.col}`);
            batch.set(depRef, {
              docId, row: cellData.row, col: cellData.col,
              value: cellData.value,
              computedValue: String(newComp),
              lastModifiedBy: user?.uid || "anonymous"
            }, { merge: true });
          }
        }
      }
    });

    setCells(newCells);
    cellsRef.current = newCells;

    try {
      await batch.commit();
      await updateDoc(doc(db, "documents", docId), { updatedAt: serverTimestamp() }).catch(() => { });
      setIsSaving(false);
    } catch (e) {
      console.error("Failed to commit cells via writeBatch:", e);
      setIsSaving(false);
    }
  };

  const getColIndex = (colStr: string) => {
    let result = 0;
    for (let i = 0; i < colStr.length; i++) {
      result = result * 26 + colStr.charCodeAt(i) - 64;
    }
    return result - 1;
  };

  const activeViewersOnCell = (cellId: string) => {
    return Object.values(viewers).filter((v) => v.currentCell === cellId && v.sessionId !== sessionId);
  };

  const exportToCsv = () => {
    let csvContent = "";
    for (let r = 1; r <= ROWS; r++) {
      const rowData = [];
      for (let c = 0; c < COLS; c++) {
        const cellId = `${indexToColLetter(c)}${r}`;
        const cell = cellsRef.current[cellId];
        let val = cell?.computedValue != null ? String(cell.computedValue) : (cell?.value || "");
        if (val.includes(",") || val.includes("\"") || val.includes("\n")) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        rowData.push(val);
      }
      csvContent += rowData.join(",") + "\n";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${docMeta?.title || "Spreadsheet"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const saveTitle = async () => {
    if (!titleValue.trim()) return

    try {
      await updateDoc(doc(db, "documents", docId), {
        title: titleValue,
        updatedAt: serverTimestamp()
      })

      setEditingTitle(false)
    } catch (err) {
      console.error("Failed to update title", err)
    }
  }
  const handleFormulaSubmit = () => {
    if (activeCell) {
      commitCell(activeCell, formulaBarValue);
      setEditingCell(null);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* TOOLBAR */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-gray-50 shrink-0 h-14">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            {editingTitle ? (
              <input
                className="border px-2 py-1 rounded text-lg font-medium outline-none bg-white"
                value={titleValue}
                autoFocus
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle()
                }}
              />
            ) : (
              <h1
                className="font-medium text-gray-800 text-lg leading-tight cursor-pointer hover:bg-gray-200 px-2 py-1 rounded"
                onClick={() => setEditingTitle(true)}
              >
                {titleValue || "Untitled Spreadsheet"}
              </h1>
            )}
            <div className="flex items-center text-xs text-gray-500 gap-2">
              {isSaving ? (
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>
              ) : (
                <span className="flex items-center gap-1"><Save className="w-3 h-3" /> Saved to cloud</span>
              )}
            </div>
          </div>
        </div>


        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setCopied(true);

              setTimeout(() => {
                setCopied(false);
              }, 2000);
            }}
            className="flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg transition-colors shadow-sm"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button
            disabled={alreadySaved}
            onClick={async () => {
              if (!user) return;

              const docRef = doc(db, "documents", docId);

              await updateDoc(docRef, {
                savedBy: arrayUnion(user.uid)
              });
            }}
            className="flex items-center gap-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded-lg disabled:bg-gray-400"
          >
            <Save className="w-4 h-4" />
            {alreadySaved ? "Saved" : "Save to My Sheets"}
          </button>
          <button
            onClick={exportToCsv}
            className="text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors border border-gray-200"
          >
            Export CSV
          </button>
          <div className="flex items-center gap-2 pl-4 border-l">
            <Users className="w-4 h-4 text-gray-400" />
            <div className="flex -space-x-2 mr-2 relative z-10 hover:z-50">
              {user && Object.keys(viewers).length === 0 && (
                <div
                  className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium shadow-sm hover:z-50 hover:-translate-y-1 transition-transform cursor-help"
                  style={{ backgroundColor: myColor }}
                  title={user.displayName || "You"}
                >
                  {(user.displayName || "Y").charAt(0).toUpperCase()}
                </div>
              )}
              {Object.entries(viewers).map(([vId, viewer]) => (
                <div
                  key={vId}
                  className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium shadow-sm hover:z-50 hover:-translate-y-1 transition-transform cursor-help"
                  style={{ backgroundColor: viewer.color }}
                  title={viewer.userId === user?.uid ? `${viewer.name} (You)` : viewer.name}
                >
                  {viewer.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-400 font-medium">
              {Math.max(1, Object.keys(viewers).length)} Active
            </span>
          </div>
        </div>
      </div>


      <div className="flex items-center gap-2 border-b bg-white px-2 py-1.5 shrink-0 h-10">
        <div className="flex items-center justify-center w-8 text-gray-400 font-serif italic font-bold select-none text-sm">fx</div>
        <div className="w-12 text-center text-sm font-medium text-gray-600 border-r pr-2 shrink-0 select-none">
          {activeCell || ""}
        </div>
        <input
          ref={formulaInputRef}
          className="flex-1 px-2 text-sm outline-none bg-transparent placeholder-gray-300"
          value={formulaBarValue}
          onChange={(e) => {
            setFormulaBarValue(e.target.value);
            if (activeCell && !editingCell) {
              setEditingCell(activeCell);
              setEditValue(e.target.value);
            } else if (editingCell) {
              setEditValue(e.target.value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && activeCell) {
              handleFormulaSubmit();
            }
          }}
          onBlur={() => {
            if (activeCell && formulaBarValue !== (cells[activeCell]?.value || "")) {
              handleFormulaSubmit();
            }
          }}
          disabled={!activeCell}
          placeholder={activeCell ? "Enter a formula or value (e.g., =SUM(A1:A5) or =A1+B2)" : "Select a cell to enter data"}
        />
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 relative">
        <table className="border-collapse table-fixed bg-white m-0">
          <thead>
            <tr>
              <th className="w-10 sticky top-0 left-0 z-20 bg-gray-100 border-b border-r border-gray-300 shadow-sm" />
              {Array.from({ length: COLS }).map((_, i) => (
                <th
                  key={i}
                  className="w-28 text-center bg-gray-50 border-b border-r border-gray-300 font-normal text-gray-600 sticky top-0 z-10 py-1 select-none"
                >
                  {indexToColLetter(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }).map((_, r) => (
              <tr key={r}>
                <td className="w-10 text-center bg-gray-50 border-b border-r border-gray-300 font-normal text-gray-600 sticky left-0 z-10 select-none">
                  {r + 1}
                </td>
                {Array.from({ length: COLS }).map((_, c) => {
                  const cellId = `${indexToColLetter(c)}${r + 1}`;
                  const cellData = cells[cellId];
                  const isActive = activeCell === cellId;
                  const isEditing = editingCell === cellId;

                  const otherViewers = activeViewersOnCell(cellId);

                  return (
                    <td
                      key={cellId}
                      className="border-b border-r border-gray-200 relative p-0"
                      onClick={() => handleCellClick(cellId)}
                      onDoubleClick={() => handleCellDoubleClick(cellId)}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          className="absolute inset-0 w-full h-full min-h-6 px-1 z-20 outline-none border-2 border-blue-500 shadow-lg text-sm bg-white"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, cellId)}
                          onBlur={() => commitCell(cellId, editValue)}
                        />
                      ) : (
                        <div
                          className={`w-full h-full min-h-6 px-1 truncate text-sm flex items-center ${isActive ? 'bg-blue-50' : ''}`}
                          tabIndex={isActive ? 0 : -1}
                          onKeyDown={(e) => handleKeyDown(e, cellId)}
                        >
                          {cellData?.computedValue != null ? cellData.computedValue : cellData?.value || ""}
                        </div>
                      )}

                      {!isEditing && isActive && (
                        <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none z-10" />
                      )}

                      {otherViewers.map((viewer, i) => (
                        <div
                          key={i}
                          className="absolute inset-0 pointer-events-none z-30"
                        >
                          <div className="absolute inset-0 border-2" style={{ borderColor: viewer.color }} />
                          {isActive ? null : (
                            <div
                              className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap z-40 shadow-sm rounded-t min-w-[30px]"
                              style={{ backgroundColor: viewer.color }}
                            >
                              {viewer.name}
                            </div>
                          )}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {copied && (
        <div className="fixed bottom-6 right-6 bg-black text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          Link copied to clipboard
        </div>
      )}

    </div>
  );
}