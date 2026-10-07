import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { executeTool } from "./tools.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const instructions = `
You are ClinicCare AI, an AI clinic appointment agent.

Your job:
- Find doctors.
- Check available appointment slots.
- Book appointments.
- Cancel appointments.
- Give current date and time when needed.

Rules:
1. Always use tools for doctor, patient, slot and appointment information.
2. Never invent doctors, fees, slots, patients or appointment IDs.
3. The model must choose the appropriate tool. Do not use keyword or if/else routing.
4. For today, tomorrow, next Monday or other relative dates, use getCurrentDateTime first.
5. Before booking, use an exact slotId returned by checkAvailableSlots.
6. Never claim an appointment was booked unless bookAppointment confirms it.
7. If a slot is already booked, clearly tell the user and suggest available slots.
8. For cancellation, use the exact appointmentId.
9. Do not provide diagnosis, medicine or dosage instructions.
10. Keep responses short and helpful.
`;

const tools = [
  {
    functionDeclarations: [
      {
        name: "findDoctor",
        description:
          "Find doctors by medical specialization.",
        parameters: {
          type: "object",
          properties: {
            specialization: {
              type: "string",
              description:
                "Medical specialization such as Dermatologist, Cardiologist, Dentist, or General Physician.",
            },
          },
          required: ["specialization"],
        },
      },
      {
        name: "checkAvailableSlots",
        description:
          "Find available appointment slots for a doctor on a specific date.",
        parameters: {
          type: "object",
          properties: {
            doctorId: {
              type: "string",
              description: "Exact doctorId returned by findDoctor.",
            },
            date: {
              type: "string",
              description: "Date in YYYY-MM-DD format.",
            },
          },
          required: ["doctorId", "date"],
        },
      },
      {
        name: "bookAppointment",
        description:
          "Book an appointment using an exact patientId and slotId.",
        parameters: {
          type: "object",
          properties: {
            patientId: {
              type: "string",
              description: "Exact patient ID.",
            },
            slotId: {
              type: "string",
              description: "Exact available slot ID.",
            },
          },
          required: ["patientId", "slotId"],
        },
      },
      {
        name: "cancelAppointment",
        description:
          "Cancel an existing appointment using its exact appointmentId.",
        parameters: {
          type: "object",
          properties: {
            appointmentId: {
              type: "string",
              description: "Exact appointment ID.",
            },
          },
          required: ["appointmentId"],
        },
      },
      {
        name: "getCurrentDateTime",
        description:
          "Get the current date and time in India.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    ],
  },
];

export async function runAgent(userMessage) {
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: userMessage,
        },
      ],
    },
  ];

  for (let round = 0; round < 8; round++) {
   let response;

for (let attempt = 0; attempt < 4; attempt++) {
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: instructions, tools },
    });
    break;
  } catch (error) {
    const message = error?.message || "";
    const retryable =
      message.includes("503") ||
      message.includes("UNAVAILABLE") ||
      message.includes("high demand");

    if (!retryable || attempt === 3) {
      throw error;
    }

    await new Promise(resolve =>
      setTimeout(resolve, 1000 * 2 ** attempt)
    );
  }
}

    const functionCalls = response.functionCalls || [];

    if (functionCalls.length === 0) {
      return response.text || "I could not generate a response.";
    }

    if (response.candidates?.[0]?.content) {
      contents.push(response.candidates[0].content);
    }

    const functionResponseParts = [];

    for (const call of functionCalls) {
      let result;

      try {
        result = await executeTool(
          call.name,
          call.args || {}
        );
      } catch (error) {
        result = {
          ok: false,
          error: error.message || "Tool execution failed",
        };
      }

      functionResponseParts.push({
        functionResponse: {
          name: call.name,
          id: call.id,
          response: {
            result,
          },
        },
      });
    }

    contents.push({
      role: "user",
      parts: functionResponseParts,
    });
  }

  return "I could not complete the request.";
}