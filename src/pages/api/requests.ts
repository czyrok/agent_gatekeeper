import type { APIRoute } from "astro"
import { listRequests } from "@/lib/egress-requests"

export const GET: APIRoute = () => Response.json(listRequests())
