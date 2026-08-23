# Solstice Pivot Journal

## Entry 1 — Pivot Decision and Repository Transition

### Date
23 August 2026

### Project State Before the Pivot

Before the pivot, the project was being developed under the North Star specification.

The North Star system focused on inventory synchronisation with a simulated warehouse API. The intended workflow involved scheduled polling of the warehouse service, retrieving inventory information, maintaining a stock cache, exposing stock-query functionality, and handling failures from the external service.

The North Star implementation is preserved as the pre-pivot baseline.

### Pivot

The project requirements changed during the sprint, requiring the system to move away from the original inventory synchronisation problem and become an event-admission prototype for Solstice Event Co.

### Decision Made

I decided to preserve the North Star work as evidence of the original specification rather than deleting or overwriting it.

The Solstice repository became the working repository for the pivot and the eventual final deliverable.

### Technical Consequences

The pivot required a change in the application's technical direction.

The project moved from:

Warehouse API
→ scheduled polling
→ inventory data
→ stock cache
→ stock query

to:

Attendee
→ check-in
→ duplicate protection
→ badge print request
→ simulated printer
→ pending/confirmed state
→ webhook update
→ browser interface

This meant that the existing North Star inventory workflow could not simply be extended to satisfy the new requirements.

### New Technical Areas Identified

The pivot introduced the need to work on:

- attendee check-in logic;
- duplicate check-in protection;
- admission state management;
- badge-printing requests;
- interaction with a simulated printer/vendor;
- asynchronous processing;
- webhook-based status updates;
- browser-based visualisation;
- new testing scenarios;
- server-side state handling.

### Development Environment

The pivot implementation was developed using GitHub Codespaces.

The Solstice project uses a Node.js/Express-based server and is run from the Codespaces terminal using:

`npm run dev`

The application is exposed through the Codespaces forwarded-port system so that the prototype can be demonstrated through a browser.

### Initial Reflection

The pivot changed more than the name or user interface of the project. It changed the underlying problem being solved and therefore required a different data flow, application state model, external-service interaction and testing strategy.

The North Star work remains valuable as the documented pre-pivot baseline and as evidence of the technical learning that informed the subsequent development.