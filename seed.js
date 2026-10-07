import dotenv from "dotenv";
import { connectDB, getClient } from "./db.js";

dotenv.config();

const db = await connectDB();

await db.collection("doctors").deleteMany({});
await db.collection("slots").deleteMany({});
await db.collection("patients").deleteMany({});
await db.collection("appointments").deleteMany({});

const doctors = [
  {
    doctorId: "D001",
    name: "Dr. Anjali Sharma",
    specialization: "Dermatologist",
    fee: 700,
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  },
  {
    doctorId: "D002",
    name: "Dr. Rahul Verma",
    specialization: "Cardiologist",
    fee: 900,
    availableDays: ["Monday", "Wednesday", "Friday"]
  },
  {
    doctorId: "D003",
    name: "Dr. Neha Kapoor",
    specialization: "Dentist",
    fee: 500,
    availableDays: ["Tuesday", "Thursday", "Saturday"]
  },
  {
    doctorId: "D004",
    name: "Dr. Arjun Mehta",
    specialization: "General Physician",
    fee: 400,
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  }
];

const patients = [
  { patientId: "P012", name: "Aman Singh", age: 21, phone: "9876543210" },
  { patientId: "P013", name: "Riya Joshi", age: 22, phone: "9876501234" },
  { patientId: "P014", name: "Karan Rawat", age: 20, phone: "9812345678" }
];

// Use dates relative to the current India date so "tomorrow" demos remain useful.
const now = new Date();
const indiaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(now);

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

const dates = [addDays(indiaDate, 1), addDays(indiaDate, 2), addDays(indiaDate, 3)];

const slotTemplates = [
  ["09:00 AM", "09:30 AM"],
  ["10:00 AM", "10:30 AM"],
  ["05:00 PM", "05:30 PM"],
  ["06:00 PM", "06:30 PM"]
];

const slots = [];
let counter = 1;

for (const doctor of doctors) {
  for (const date of dates) {
    for (const [start, end] of slotTemplates) {
      slots.push({
        slotId: `S${String(counter).padStart(3, "0")}`,
        doctorId: doctor.doctorId,
        date,
        time: `${start} - ${end}`,
        isBooked: false
      });
      counter++;
    }
  }
}

// Make one known slot booked for the demo so the agent can prove it refuses.
slots[2].isBooked = true;

await db.collection("doctors").insertMany(doctors);
await db.collection("patients").insertMany(patients);
await db.collection("slots").insertMany(slots);

console.log("Seed complete.");
console.log("Demo patient: P012");
console.log(`Demo dates: ${dates.join(", ")}`);
console.log(`Example available slot: ${slots.find(s => !s.isBooked)?.slotId}`);
console.log(`Example already-booked slot: ${slots.find(s => s.isBooked)?.slotId}`);

await getClient().close();
