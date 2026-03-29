module.exports = function handler(_req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(
    `window.AUTH_CONFIG = ${JSON.stringify({
      supabaseUrl,
      supabaseAnonKey
    })};`
  );
};
