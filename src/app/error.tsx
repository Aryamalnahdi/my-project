"use client";
export default function ErrorScreen({ reset }: { reset: () => void }) {
  return <main className="error-page"><h1>We couldn’t load this screen.</h1><p>Please try again. If the problem continues, contact your administrator.</p><button className="button primary" onClick={reset}>Try again</button></main>;
}
