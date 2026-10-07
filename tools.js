import { getDB, getClient } from "./db.js";
import { ObjectId } from "mongodb";

function clean(value) {
  if (value === undefined || value === null) return value;
  if (value instanceof ObjectId) return value.toString();
  if (Array.isArray(value)) return value.map(clean);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = clean(v);
    return out;
  }
  return value;
}

export async function findDoctor({ specialization }) {
  const db = getDB();

  const doctors = await db.collection("doctors")
    .find(
      { specialization: { $regex: specialization, $options: "i" } },
      {
        projection: {
          _id: 0,
          doctorId: 1,
          name: 1,
          specialization: 1,
          fee: 1,
          availableDays: 1
        }
      }
    )
    .limit(5)
    .toArray();

  if (!doctors.length) {
    return {
      found: false,
      message: `No doctor found for specialization "${specialization}".`
    };
  }

  return { found: true, doctors: clean(doctors) };
}

export async function checkAvailableSlots({ doctorId, date }) {
  const db = getDB();

  const query = {
    doctorId,
    date,
    isBooked: false
  };

  const slots = await db.collection("slots")
    .find(query, {
      projection: {
        _id: 0,
        slotId: 1,
        doctorId: 1,
        date: 1,
        time: 1,
        isBooked: 1
      }
    })
    .sort({ time: 1 })
    .toArray();

  if (!slots.length) {
    return {
      found: false,
      message: `No available slots found for doctor ${doctorId} on ${date}.`
    };
  }

  return { found: true, slots: clean(slots) };
}

export async function bookAppointment({ patientId, slotId }) {
  const db = getDB();
  const client = getClient();
  const session = client.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const patient = await db.collection("patients").findOne(
        { patientId },
        {
          projection: {
            _id: 0,
            patientId: 1,
            name: 1,
            age: 1,
            phone: 1
          },
          session
        }
      );

      if (!patient) {
        throw new Error(`No patient found with patient ID ${patientId}.`);
      }

      const slot = await db.collection("slots").findOne(
        { slotId },
        {
          projection: {
            _id: 0,
            slotId: 1,
            doctorId: 1,
            date: 1,
            time: 1,
            isBooked: 1
          },
          session
        }
      );

      if (!slot) {
        throw new Error(`No slot found with slot ID ${slotId}.`);
      }

      if (slot.isBooked === true) {
        throw new Error(`Slot ${slotId} is already booked. Please choose another slot.`);
      }

      const doctor = await db.collection("doctors").findOne(
        { doctorId: slot.doctorId },
        {
          projection: {
            _id: 0,
            doctorId: 1,
            name: 1,
            specialization: 1,
            fee: 1
          },
          session
        }
      );

      if (!doctor) {
        throw new Error(`Doctor ${slot.doctorId} was not found.`);
      }

      // Step 1: atomically reserve the slot only if it is still free.
      const slotUpdate = await db.collection("slots").updateOne(
        { slotId, isBooked: false },
        { $set: { isBooked: true } },
        { session }
      );

      if (slotUpdate.modifiedCount !== 1) {
        throw new Error(`Slot ${slotId} was just taken by another patient. Please choose another slot.`);
      }

      // Step 2: create the appointment.
      const appointmentId = `APT${Date.now()}${Math.floor(Math.random() * 1000)}`;

      await db.collection("appointments").insertOne(
        {
          appointmentId,
          patientId,
          patientName: patient.name,
          doctorId: doctor.doctorId,
          doctorName: doctor.name,
          slotId,
          date: slot.date,
          time: slot.time,
          status: "booked",
          createdAt: new Date()
        },
        { session }
      );

      result = {
        success: true,
        appointmentId,
        patient,
        doctor,
        slot
      };
    });

    return clean(result);
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  } finally {
    await session.endSession();
  }
}

export async function cancelAppointment({ appointmentId }) {
  const db = getDB();
  const client = getClient();
  const session = client.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const appointment = await db.collection("appointments").findOne(
        { appointmentId },
        { session }
      );

      if (!appointment) {
        throw new Error(`No appointment found with ID ${appointmentId}.`);
      }

      if (appointment.status === "cancelled") {
        throw new Error(`Appointment ${appointmentId} is already cancelled.`);
      }

      const appointmentUpdate = await db.collection("appointments").updateOne(
        { appointmentId, status: "booked" },
        {
          $set: {
            status: "cancelled",
            cancelledAt: new Date()
          }
        },
        { session }
      );

      if (appointmentUpdate.modifiedCount !== 1) {
        throw new Error(`Appointment ${appointmentId} could not be cancelled.`);
      }

      // Free the slot again.
      const slotUpdate = await db.collection("slots").updateOne(
        { slotId: appointment.slotId },
        { $set: { isBooked: false } },
        { session }
      );

      if (slotUpdate.modifiedCount !== 1) {
        throw new Error(`Could not free slot ${appointment.slotId}.`);
      }

      result = {
        success: true,
        appointmentId,
        slotId: appointment.slotId,
        message: `Appointment ${appointmentId} cancelled and slot ${appointment.slotId} is free again.`
      };
    });

    return clean(result);
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  } finally {
    await session.endSession();
  }
}

export function getCurrentDateTime() {
  const now = new Date();

  return {
    iso: now.toISOString(),
    date: now.toISOString().slice(0, 10),
    day: now.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }),
    time: now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata"
    }),
    timezone: "Asia/Kolkata"
  };
}

export const toolDefinitions = [
  {
    type: "function",
    name: "findDoctor",
    description: "Find doctors matching a medical specialization. Use this for doctor/specialist recommendations. Do not diagnose the patient.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        specialization: {
          type: "string",
          description: "Medical specialization, for example Dermatologist, Cardiologist, Dentist."
        }
      },
      required: ["specialization"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "checkAvailableSlots",
    description: "Find free appointment slots for a specific doctor on an exact YYYY-MM-DD date.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        doctorId: {
          type: "string",
          description: "Doctor ID from the database."
        },
        date: {
          type: "string",
          description: "Exact date in YYYY-MM-DD format."
        }
      },
      required: ["doctorId", "date"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "bookAppointment",
    description: "Book a free slot for a patient. This writes an appointment and marks the slot booked. Never use it until the user has selected a specific slot and patient ID.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        patientId: {
          type: "string",
          description: "Patient ID, for example P012."
        },
        slotId: {
          type: "string",
          description: "Exact slot ID chosen by the patient."
        }
      },
      required: ["patientId", "slotId"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "cancelAppointment",
    description: "Cancel an existing booked appointment and free its slot.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        appointmentId: {
          type: "string",
          description: "Appointment ID to cancel."
        }
      },
      required: ["appointmentId"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "getCurrentDateTime",
    description: "Get the current date and time in India. Use this for words like today, tomorrow, this week, or current date.",
    strict: true,
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false
    }
  }
];

export async function executeTool(name, args) {
  switch (name) {
    case "findDoctor":
      return await findDoctor(args);
    case "checkAvailableSlots":
      return await checkAvailableSlots(args);
    case "bookAppointment":
      return await bookAppointment(args);
    case "cancelAppointment":
      return await cancelAppointment(args);
    case "getCurrentDateTime":
      return getCurrentDateTime();
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
