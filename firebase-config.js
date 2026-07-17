// firebase-config.js
// -----------------------------------------------------------------------------
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://fcpfbytheqzvhnyohlxe.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"; // <-- Keep your actual public anon key here!

// Safe client instantiation
export let supabase;
try {
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY") {
    console.warn("Supabase API initialization halted: Missing valid public Anon Key.");
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.error("Critical Supabase initialization error:", err.message);
}

// ---- Event Constants ----
export const ADMIN_PASSWORD = "rescope-admin-2k26";

export const HOUSES = [
  { id: "Horizon", label: "HORIZON", color: "#06AED5", passcode: "horizon26" },
  { id: "Eclipse", label: "ECLIPSE", color: "#1B1F3B", passcode: "eclipse26" },
  { id: "Vector", label: "VECTOR", color: "#0B8457", passcode: "vector26" },
  { id: "Chroma", label: "CHROMA", color: "#D7263D", passcode: "chroma26" },
];

export function houseById(id) {
  return HOUSES.find((h) => h.id === id);
}

// ---- Seed Initialization ----
export async function seedTeamsIfEmpty() {
  if (!supabase) return;
  const { data, error } = await supabase.from("teams").select("id").limit(1);
  if (error) throw error;
  if (data && data.length > 0) return;

  const rows = HOUSES.map((house) => ({
    id: house.id,
    name: house.id,
    color: house.color,
    totalPoints: 0,
  }));

  await supabase.from("teams").insert(rows);
}

// ---- Real-Time Synchronization Listeners ----
export function listenTeams(callback) {
  if (!supabase) return () => {};
  const fetchTeams = async () => {
    const { data, error } = await supabase.from("teams").select("*");
    if (error) console.error("Teams fetch error:", error.message);
    if (data) callback(data);
  };

  fetchTeams();

  const channel = supabase
    .channel("teams-follow")
    .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, fetchTeams)
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function listenParticipants(callback) {
  if (!supabase) return () => {};
  const fetchParticipants = async () => {
    const { data, error } = await supabase.from("participants").select("*");
    if (error) console.error("Participants fetch error:", error.message);
    if (data) callback(data);
  };

  fetchParticipants();

  const channel = supabase
    .channel("participants-follow")
    .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, fetchParticipants)
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function listenPrograms(callback) {
  if (!supabase) return () => {};
  const fetchPrograms = async () => {
    const { data, error } = await supabase.from("programs").select("*");
    if (error) console.error("Programs fetch error:", error.message);
    if (data) callback(data);
  };

  fetchPrograms();

  const channel = supabase
    .channel("programs-follow")
    .on("postgres_changes", { event: "*", schema: "public", table: "programs" }, fetchPrograms)
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// ---- Roster Registrations & Deletions ----
export async function registerParticipant(code, name, teamId) {
  if (!supabase) throw new Error("Database client not connected.");
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode || !name.trim()) throw new Error("Name and code are required.");

  const { data: existing } = await supabase
    .from("participants")
    .select("id")
    .eq("id", cleanCode)
    .maybeSingle();

  if (existing) throw new Error(`Code "${cleanCode}" is already registered.`);

  const { error } = await supabase.from("participants").insert({
    id: cleanCode,
    name: name.trim(),
    team: teamId,
    totalPoints: 0,
  });

  if (error) throw error;
  return cleanCode;
}

export async function deleteParticipant(code) {
  if (!supabase) throw new Error("Database client not connected.");
  const cleanCode = code.trim().toUpperCase();

  const { error } = await supabase
    .from("participants")
    .delete()
    .eq("id", cleanCode);

  if (error) throw error;
  return cleanCode;
}

// ---- Program Management ----
export async function addProgram(code, title) {
  if (!supabase) throw new Error("Database client not connected.");
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode || !title.trim()) throw new Error("Program code and title are required.");

  const { data: existing } = await supabase
    .from("programs")
    .select("id")
    .eq("id", cleanCode)
    .maybeSingle();

  if (existing) throw new Error(`Program "${cleanCode}" already exists.`);

  const { error } = await supabase.from("programs").insert({
    id: cleanCode,
    title: title.trim(),
    scores: {},
  });

  if (error) throw error;
  return cleanCode;
}

export async function deleteProgram(code) {
  if (!supabase) return;
  await supabase.from("programs").delete().eq("id", code.trim().toUpperCase());
}

// ---- Core Point System (RPC Transaction) ----
export async function awardPoints(programCode, participantCode, delta) {
  if (!supabase) throw new Error("Database client not connected.");
  const cleanProgram = programCode.trim().toUpperCase();
  const cleanParticipant = participantCode.trim().toUpperCase();

  const { data, error } = await supabase.rpc("award_points", {
    p_program_code: cleanProgram,
    p_participant_code: cleanParticipant,
    p_delta: parseInt(delta, 10),
  });

  if (error) throw new Error(error.message);
  return data; 
}

// ---- Backward Compatibility Lookup ----
export async function getParticipant(code) {
  if (!supabase) return null;
  const { data } = await supabase
    .from("participants")
    .select("*")
    .eq("id", code.trim().toUpperCase())
    .maybeSingle();
  return data;
}
