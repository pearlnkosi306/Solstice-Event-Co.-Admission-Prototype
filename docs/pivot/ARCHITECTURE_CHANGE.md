# Architecture Change — North Star to Solstice

## Before the Pivot

The North Star system was structured around:

Warehouse API
→ scheduled polling
→ inventory data
→ stock cache
→ stock query

Failure handling was primarily concerned with unreliable external inventory requests.

## After the Pivot

The Solstice system is structured around:

Attendee
→ check-in
→ duplicate protection
→ badge print request
→ simulated printer
→ pending/confirmed state
→ webhook update
→ browser display

## Why the Architecture Changed

The business workflow changed completely.

The original system answered an inventory question:

"What stock is currently available?"

The new system answers an admission question:

"Has this attendee been checked in, and has their badge-printing process been completed?"

Because the problem changed, the data flow, state management and external-service interaction also had to change.