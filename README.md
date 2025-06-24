# Cruise Booking Project

This project demonstrates a cruise reservation system built with **Node.js** microservices and a simple React/Next.js frontend.

The application was created for a messaging‑oriented middleware assignment and showcases:

- REST APIs between the frontend and backend services
- Asynchronous communication among services using **RabbitMQ**
- Real‑time notifications to the browser via **Server‑Sent Events (SSE)**
- Webhook callbacks from an external payment simulator

## Microservices

### Reservation Service (`reservation/`)

Handles all HTTP endpoints consumed by the frontend:

- `GET /itinerarios` – query cruises from the Itinerary service
- `POST /reservas` – create a reservation and request a payment link
- `DELETE /reservas/:id` – cancel a reservation
- `GET /reservas/:id` – check reservation status
- `GET /notifications/:clientId` – SSE channel for status/promotions
- `POST /interests/:clientId` and `DELETE /interests/:clientId` – manage promotion subscriptions

It also listens for events from RabbitMQ (`pagamento-aprovado`, `pagamento-recusado`, `bilhete-gerado`) and pushes updates to connected clients.

### Itinerary Service (`itinerary/`)

Provides cruise information stored in `cruises.json` and updates cabin availability based on reservation events.
Runs on **port 4000**.

### Payment Service (`payment/`)

Offers a REST endpoint for the Reservation service to request payment links and exposes `/webhook` to receive asynchronous
notifications from the external payment system. Approved or rejected payments are published back to RabbitMQ.
Runs on **port 4001**.

### Ticket Service (`ticket/`)

Consumes `pagamento-aprovado` messages and generates a travel ticket, publishing a new `bilhete-gerado` event.

### Marketing Service (`marketing/`)

Publishes promotional cruise offers to the `promocoes` queue. The helper script `promogen.js` can generate sample promotions.

### External Payment Simulator (`payment-external/`)

A small Express server that emulates a payment gateway. It returns a fake payment link and later posts the transaction
status to the Payment service webhook. Runs on **port 4002**.

## Frontend

Located at the repository root, built with **Next.js** and styled with **Tailwind CSS**. Users can:

1. Search available cruises
2. Create or cancel reservations
3. Subscribe to promotional notifications
4. Receive real‑time updates for reservation status and promotions via SSE

Run `npm install` in the root folder to install frontend dependencies. Start the development server with:

```bash
npm run dev
```

The frontend communicates with the Reservation service running on port **3000**.

## Running the Microservices

Ensure **RabbitMQ** is running locally on `amqp://localhost`. Install dependencies for the Reservation service and the
payment simulator:

```bash
cd reservation && npm install
cd ../payment-external && npm install
```

Other services use only built‑in modules or dependencies already installed in the root project.

A `Makefile` is provided to start the main microservices (except the frontend):

```bash
make start
```

This command launches:

- External payment simulator (port 4002)
- Payment service (port 4001)
- Ticket service
- Reservation service (port 3000)
- Itinerary service (port 4000)

Use `make stop` to terminate them.     React components used in the frontend
