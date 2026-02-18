import React from "react";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function About() {
  return (
    <div className="space-y-6">
      <SectionTitle
        title="About TellNab"
        subtitle="A platform for direct, honest, and practical advice."
      />

      <Card>
        <h3 className="text-lg font-semibold text-white">Why TellNab exists</h3>
        <p className="mt-3 text-slate-300">
          Most advice spaces are either too filtered or too chaotic. TellNab is
          designed to keep advice unfiltered in tone but structured in quality.
          We encourage clear questions, candid replies, and respectful behavior.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-violet-200">Principle 1</p>
          <h4 className="mt-2 font-semibold text-white">Honesty first</h4>
          <p className="mt-2 text-sm text-slate-300">
            Direct feedback beats vague positivity.
          </p>
        </Card>
        <Card>
          <p className="text-sm text-sky-200">Principle 2</p>
          <h4 className="mt-2 font-semibold text-white">Respect always</h4>
          <p className="mt-2 text-sm text-slate-300">
            No abuse, harassment, or hate allowed.
          </p>
        </Card>
        <Card>
          <p className="text-sm text-emerald-200">Principle 3</p>
          <h4 className="mt-2 font-semibold text-white">Actionable advice</h4>
          <p className="mt-2 text-sm text-slate-300">
            Answers should help users take the next step.
          </p>
        </Card>
      </div>
    </div>
  );
}
