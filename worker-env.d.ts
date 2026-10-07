// The optional starter database helper expects a binding named DB.
// This roadmap has no database configured in .openai/hosting.json.
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
  }
}
