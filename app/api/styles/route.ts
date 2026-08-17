import { THEMES } from "../../../lib/backgrounds";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ styles: Object.keys(THEMES) }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
