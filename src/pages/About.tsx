import React from "react";
import { Link } from "react-router-dom";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { useSeo } from "../utils/seo";

export default function About() {
  useSeo({
    title: "About TellNab - Honest Advice, Strong Moderation",
    description:
      "Learn how TellNab combines candid advice with moderation standards to help people make better life decisions.",
    path: "/about",
  });

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

      <Card>
        <h3 className="text-lg font-semibold text-white">Safety in practice</h3>
        <p className="mt-2 text-sm text-slate-300">
          We enforce abuse and spam controls through user reports and moderator
          actions. Review our clear enforcement and urgent-safety policy in
          community terms.
        </p>
        <Link
          to="/terms"
          className="mt-3 inline-flex rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/20"
        >
          Read safety terms
        </Link>
      </Card>
    </div>
  );
}
