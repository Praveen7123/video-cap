import { useEffect, useState } from "react";
import api from "@/lib/api";
import { AppShell } from "@/components/Layout";
import { Play } from "lucide-react";

export default function Tutorials() {
    const [projects, setProjects] = useState([]);
    useEffect(() => {
        api.get("/projects").then(({ data }) => setProjects(data)).catch(() => { });
    }, []);

    const tutorials = [
        { title: "Getting Started with Kalakar", duration: "3:45", category: "Basics" },
        { title: "Mastering Word-by-Word Captions", duration: "5:12", category: "Advanced" },
        { title: "Cleaning Audio like a Pro", duration: "2:30", category: "Audio" },
        { title: "Using the Command Palette", duration: "1:45", category: "Tips" },
        { title: "Generating Seamless Loops", duration: "4:10", category: "Engagement" },
        { title: "Color Grading your footage", duration: "3:30", category: "Visuals" },
    ];

    return (
        <AppShell projects={projects}>
            <main className="px-6 md:px-10 py-8 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h1 className="text-2xl font-semibold tracking-tight">Tutorials</h1>
                <p className="mt-1 text-sm text-muted-ink mb-8">Learn how to make the most out of your editing experience.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tutorials.map((t, idx) => (
                        <div key={idx} className="bg-card border border-line rounded-xl overflow-hidden group cursor-pointer hover:border-line-2 transition-colors">
                            <div className="aspect-video bg-[#1a1a1a] relative flex items-center justify-center">
                                <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur border border-line flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Play className="w-5 h-5 text-white ml-1" />
                                </div>
                                <div className="absolute bottom-3 right-3 bg-black/80 px-2 py-1 rounded text-[10px] font-medium text-white">{t.duration}</div>
                            </div>
                            <div className="p-4">
                                <div className="text-[10px] text-hilite font-semibold uppercase tracking-wider mb-1">{t.category}</div>
                                <div className="text-sm font-medium text-white">{t.title}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </AppShell>
    );
}
