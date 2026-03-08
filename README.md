# Real-Time Collaborative Spreadsheet

A lightweight **real-time collaborative spreadsheet application** built for the **Trademarkia Frontend Engineering Assignment**.

This project implements a minimal version of **Google Sheets-style collaboration**, focusing on **real-time synchronization, collaborative presence, and formula evaluation**, while maintaining clean architecture and strong TypeScript practices.

---


# Tech Stack

- **Next.js (App Router)** – Application framework and routing
- **TypeScript** – Type safety and maintainable code
- **Tailwind CSS** – Utility-first styling
- **Firebase Authentication** – Google login for identity
- **Firebase Firestore** – Real-time collaborative database
- **React Context API** – Global authentication state management

These technologies were chosen because they allow building a **scalable real-time collaborative frontend without requiring a custom backend server**.

---

# Project Overview

The goal of this assignment was to build a **minimal collaborative spreadsheet system** with the following core features:

- Document dashboard
- Real-time collaborative editor
- Presence awareness
- User identity
- Spreadsheet formulas
- Live deployment



---

# Features

## 1. Document Dashboard

The application starts with a **dashboard listing spreadsheet documents**.

Each document displays:

- Document title
- Last modified timestamp
- Authenticated access

Users can:

- View available documents
- Open a document for editing

This serves as the entry point for the collaborative editing experience.

---

## 2. Spreadsheet Editor

The editor implements a **scrollable spreadsheet grid** similar to a simplified Google Sheets interface.

Features include:

- Rows numbered sequentially (1,2,3...)
- Columns labeled alphabetically (A,B,C...)
- Editable cells
- Real-time synchronization

Users can directly type:

- Numbers
- Text
- Spreadsheet formulas

Example cells:


A1 = 10
A2 = 20
A3 = =SUM(A1:A2)


The result is calculated dynamically.

---

## 3. Formula Support

A custom **formula evaluation engine** was implemented to support spreadsheet calculations.

Supported functions include:


SUM
AVERAGE
COUNT
MAX
MIN
PRODUCT


Example formulas:


=SUM(A1:A5)
=A1 + B2
=AVERAGE(B1:B5)
=MAX(A1:A10)
=MIN(A1:A10)


### Range Parsing

Ranges such as:


A1:B3


are expanded internally to:


A1
A2
A3
B1
B2
B3


### Circular Dependency Detection

The formula engine includes **cycle detection**.

Example invalid dependency:


A1 = B1 + 1
B1 = A1 + 1


This would normally cause an infinite loop, so the engine tracks visited cells to prevent recursion errors.

---

## 4. Real-Time Synchronization

Real-time collaboration is implemented using **Firebase Firestore listeners**.

When a user edits a cell:

1. The change is written to Firestore
2. Firestore broadcasts the update
3. All connected sessions receive the update instantly

This enables **live editing across multiple browser tabs or users**.

Example workflow:


User A edits A1 → Firestore update → User B sees update instantly


A **write-state indicator** shows when updates are being synced to the backend.

---

## 5. Presence System

Presence awareness allows users to see **who else is currently editing the document**.

Each active collaborator displays:

- Display name
- Unique color

Presence updates in real time when:

- A user enters the document
- A user leaves the document

This feature improves collaboration visibility.

---

## 6. Authentication

Authentication is implemented using **Firebase Authentication with Google Sign-In**.

Users can:

- Sign in using Google
- Maintain persistent sessions
- Log out securely

Authentication state is managed globally using **React Context**.

The context exposes:


user
loading
login()
logout()


This allows components across the application to access authentication state without prop drilling.

---

# Architecture

The project follows a **modular component-based architecture**.


app/
page.tsx
dashboard/
editor/
layout.tsx

components/
Spreadsheet.tsx

context/
AuthContext.tsx

lib/
firebase.ts
formula.ts

styles/
globals.css


### Key Architectural Decisions

**1. Next.js App Router**

The App Router was used for clean routing and scalable application structure.

**2. Firebase Backend**

Firebase provides:

- Real-time data updates
- Authentication
- Cloud-hosted database

This allows the project to remain **frontend-focused without building a custom backend**.

**3. Client-side Formula Engine**

Formulas are evaluated client-side to reduce latency and simplify architecture.

**4. React Context for Global State**

Authentication state is managed globally using React Context to keep the component tree clean.

---


# Real-Time Flow

Example collaboration flow:

1. User opens a document
2. Client subscribes to Firestore listeners
3. User edits a cell
4. Update is written to Firestore
5. Firestore broadcasts update
6. Other sessions receive update instantly

This ensures consistent state across all connected users.

---

# Running the Project Locally

### Clone the repository


git clone https://github.com/Chetan-the/Trademarkia_spread_sheet


### Install dependencies


npm install


### Configure Firebase

Create a `.env.local` file.


NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=


### Run the development server


npm run dev


Open the application at:


http://localhost:3000


---

# Deployment

The application is deployed using **Vercel**.

Deployment process:

1. Connect the GitHub repository to Vercel
2. Add Firebase environment variables
3. Deploy

The project builds successfully with:

- Strict TypeScript enabled
- No ignored TypeScript errors
- Production-ready build


