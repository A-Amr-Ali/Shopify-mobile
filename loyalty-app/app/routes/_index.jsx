// App home — minimal health/landing route for Phase 1.
export const loader = async () => {
  return new Response(
    JSON.stringify({ app: "sofie-loyalty", phase: 1, status: "ok" }),
    { headers: { "content-type": "application/json" } }
  );
};
