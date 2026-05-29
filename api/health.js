export function GET() {
  return Response.json(
    {
      ok: true,
      hasApiKey: Boolean(process.env.LOSTARK_API_KEY?.trim()),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
