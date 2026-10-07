# Clinic Appointment Agent

Hackathon Problem Set 3 implementation.

## Stack

- JavaScript
- Node.js
- Express.js
- MongoDB Atlas
- OpenAI Responses API
- OpenAI function tools

## Features

1. Find doctor by specialization
2. Check available slots
3. Book appointment
4. Cancel appointment
5. Current date/time
6. Real agent loop: model chooses tools
7. MongoDB writes are real
8. Booking uses a MongoDB transaction
9. No database dump is sent to the model
10. Out-of-scope medicine/diagnosis questions are refused

## Setup

### 1. Install Node.js

Use Node.js 20+.

### 2. Install dependencies

```bash
npm install
```

### 3. Create .env

Copy `.env.example` to `.env` and fill in:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.5
MONGODB_URI=...
DB_NAME=clinic_agent
PORT=3000
```

### 4. Seed MongoDB

```bash
npm run seed
```

This creates:

- 4 doctors
- 3 patients
- multiple future slots
- one already-booked slot for testing

Demo patient:

```text
P012
```

### 5. Start

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Demo questions

### Tool 1: findDoctor

```text
I have a skin problem, which doctor should I see?
```

Expected tool:

```text
findDoctor
```

### Tool 2: current date + slot lookup

```text
Is Dr. Sharma free tomorrow evening?
```

Expected tools:

```text
getCurrentDateTime
checkAvailableSlots
```

### Tool 3: booking

First ask:

```text
Is Dr. Sharma free tomorrow evening?
```

Then choose a returned slot:

```text
Book slot Sxxx for patient P012.
```

Expected:

```text
bookAppointment
```

MongoDB should contain a new appointment and the selected slot should have:

```text
isBooked: true
```

### Tool 4: cancellation

```text
Cancel appointment APT...
```

Expected:

```text
cancelAppointment
```

The appointment becomes cancelled and the slot becomes free again.

### Out of scope

```text
What medicine should I take for my rash?
```

The agent should refuse medical treatment advice and explain that it can help with appointments.

## Important judging point

The application does NOT use an if/else chain to decide what tool to call.

The model receives the tool definitions and chooses a function. The application executes that function, sends a `function_call_output` back to the Responses API, and repeats until the model produces the final answer.

The booking tool performs a real database write.

For a production system, authentication, authorization, medical privacy controls, audit logs, stronger validation, and clinical safety processes would also be required.
