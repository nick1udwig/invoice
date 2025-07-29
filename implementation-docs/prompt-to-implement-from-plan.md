## GOAL

Make an invoice-making Hyperware app

## Instructions

Look carefully at IMPLEMENTATION_PLAN.md and in the resources/ directory, if relevant. In particular, note the example applications resources/example-apps/sign/ and resources/example-apps/id/ resources/example-apps/file-explorer. Use these if useful

Work from the existing template that exists at skeleton-app/ and ui/

Note in particular that bindings for the UI will be generated when the app is built with `kit build --hyperapp`. As such, first design and implement the backend; from the backend, the interface will be generated; finally design and implement the frontend to consume the interface. Subsequent changes to the interface must follow this pattern as well: start in backend, generated interface, finish in frontend

Do NOT create the API. The API is machine generated. You create types that end up in the API by defining and using them in functions in the Rust backend "hyperapp"

Implement the application described in the IMPLEMENTATION_PLAN.md
