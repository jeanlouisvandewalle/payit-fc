/* Koppeling van selectie.html met de Supabase-database (zie supabase/selectie.sql).
   Beide waarden staan in Supabase onder Project Settings > API. De sleutel hier is de
   publieke ("anon" / "publishable") sleutel: die mag in de website staan. Zet hier NOOIT
   de "service_role" / "secret" sleutel. */
window.PAYIT_SELECTIE = {
  url: "https://rxqkuynzktkrznoyhxda.supabase.co",
  key: "sb_publishable_2dwoF8n9rM9WI_1-WbQBHw_iXThBRJX" // publieke sleutel
};
