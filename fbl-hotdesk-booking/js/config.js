// Paste each Power Automate HTTP-trigger URL in as you build it (see
// docs/POWER_AUTOMATE_FLOWS.md). Leave any endpoint blank and that part
// of the app runs on local sample data instead — see docs/SETUP.md.
//
// Key names below are the flow name with "HD_" dropped and the first
// letter lower-cased, e.g. HD_AdminSave -> adminSave, HD_GetLocations
// -> getLocations, HD_AdminGetBookings -> adminGetBookings.
const CONFIG = {
  endpoints: {
    getLocations: "https://e8a2c715af0feec8b14699a3964e10.cb.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/14/workflows/efe762cf7d1145ccaeb63f61f518a00c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pARBtvQSxZzM6TzRDQbTRB5gIecD3uKDXQPTUbzf4Yc",        // HD_GetLocations
    getBuildings: "https://e8a2c715af0feec8b14699a3964e10.cb.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/02/workflows/b014af5bb7864d29ab300914314a93f3/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fa1zqOESghgSiX059SKX_DW1Fjm14Pz-HipuIEV_UoU",        // HD_GetBuildings
    getWorkTypes: "https://e8a2c715af0feec8b14699a3964e10.cb.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/26/workflows/7575e058180d48859edd5bd808aa93b0/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=tYloMScdUFRXKulEB92hlgC1mWcjSgjK8J0Y6L4TkD8",        // HD_GetWorkTypes
    getEquipment: "https://e8a2c715af0feec8b14699a3964e10.cb.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/27/workflows/c1517fd165414fe2818f38e1f197608f/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3oWryrgdPrFxM6Xb38SX1wlCR6UZQRM8nYvEWamE9Vc",        // HD_GetEquipment
    getDesks: "https://e8a2c715af0feec8b14699a3964e10.cb.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/09/workflows/55e327b673ee4c4a8de49d8059226936/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=H-CHoB4AiZyhTZJvPa2V7dRIW3mYOP2tw4FmiFpJHec",            // HD_GetDesks
    adminGetAll: "https://e8a2c715af0feec8b14699a3964e10.cb.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/09/workflows/d351de76c9d14ae79098d0be576edf05/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=1bClWtNgKKlDGhka-rwuhBJgO8Rec9pHruEOryMvsZs",         // HD_AdminGetAll
    createBooking: "https://e8a2c715af0feec8b14699a3964e10.cb.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/30/workflows/899d900029f1439db59a7f06cbdc967e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=W4bL7uP_3kBJlXX3VK-gDTEiKrMnZOIFbVi6eWDSTWU",       // HD_CreateBooking
    cancelBooking: "https://e8a2c715af0feec8b14699a3964e10.cb.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/20/workflows/313ff6f04e8d4db5ac54b9934207f69b/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=26KD3_xileyOpiBP8nAx_Ed1C5f9t_34MnVqpEt4Nrk",       // HD_CancelBooking
    adminSave: "https://e8a2c715af0feec8b14699a3964e10.cb.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/15/workflows/f90c22b73ba54d738d8a8a8a49e2291a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=hBZ9B2GifURaBrEooAIpdFjc1tIkAvzFJLOZI7FjW-U",           // HD_AdminSave
    adminDelete: "https://e8a2c715af0feec8b14699a3964e10.cb.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/26/workflows/2fe0e1c7ea144f56a903179be927ddc0/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=7_Y4bDuwRkjGv_wYYfN9K3URjS8Gg_IkFpXQp5B91Jg",         // HD_AdminDelete
    adminGetBookings: "https://e8a2c715af0feec8b14699a3964e10.cb.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/29/workflows/0f5ebcc8a26848daac611f689fa56320/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=oRfi6vG1uH3b2p1bnA0qA2pM4Ew8QgEptna3F3nw5MI",    // HD_AdminGetBookings
    adminCancelBooking: "https://e8a2c715af0feec8b14699a3964e10.cb.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/25/workflows/71dea129ad404106a5bdd97f957803be/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=3tCk3txP81v85B5u_zuKBdLj-bhx1H7WHhbvTURrmjQ",  // HD_AdminCancelBooking
    checkAdminAccess: "",    // HD_CheckAdminAccess (optional, see README)
  },

  // Fallback admin login while HD_CheckAdminAccess isn't wired up yet.
  // Change this before sharing the link with anyone. See the README for
  // why this is a placeholder, not the intended long-term login method.
  adminAccessCode: "fbl-desks",

  // Used to build the cancellation link put in confirmation emails.
  // Set this to the real GitHub Pages URL once deployed.
  siteBaseUrl: window.location.origin + window.location.pathname.replace(/index\.html$/, ""),
};
