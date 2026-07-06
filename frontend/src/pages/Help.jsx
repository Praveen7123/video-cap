import { useEffect, useState } from "react";
import api from "@/lib/api";
import { AppShell } from "@/components/Layout";
import { MessageSquare, ExternalLink, FileText, Mail, LifeBuoy } from "lucide-react";

export default function Help() {
    const [projects, setProjects] = useState([]);
    useEffect(() => {
        api.get("/projects").then(({ data }) => setProjects(data)).catch(() => { });
    }, []);

    return (
        <AppShell projects={projects}>
            <main className="px-6 md:px-10 py-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h1 className="text-2xl font-semibold tracking-tight">Help & Support</h1>
                <p className="mt-1 text-sm text-muted-ink mb-8">Need assistance? Our community and dedicated support team are here to keep your creative workflow uninterrupted.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                    <a href="#" className="group relative bg-card border border-line rounded-xl p-5 overflow-hidden hover:border-line-2 transition-all duration-300">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                            <FileText className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-ink mb-1.5">Documentation</h3>
                        <p className="text-[11px] text-muted-ink mb-5 leading-relaxed min-h-[32px]">
                            Master Kalakar with our comprehensive guides, ranging from basic cuts to advanced API integration.
                        </p>
                        <span className="text-[11px] font-medium text-indigo-400 flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                            Read docs <ExternalLink className="w-3 h-3" />
                        </span>
                    </a>

                    <a href="#" className="group relative bg-card border border-line rounded-xl p-5 overflow-hidden hover:border-line-2 transition-all duration-300">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                            <MessageSquare className="w-5 h-5 text-purple-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-ink mb-1.5">Community Discord</h3>
                        <p className="text-[11px] text-muted-ink mb-5 leading-relaxed min-h-[32px]">
                            Join 2000+ creators sharing viral templates, workflows, and instant peer-to-peer troubleshooting.
                        </p>
                        <span className="text-[11px] font-medium text-purple-400 flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                            Join Server <ExternalLink className="w-3 h-3" />
                        </span>
                    </a>

                    <a href="mailto:support@kalakar.io" className="group relative bg-card border border-line rounded-xl p-5 overflow-hidden hover:border-line-2 transition-all duration-300">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                            <Mail className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-ink mb-1.5">Priority Support</h3>
                        <p className="text-[11px] text-muted-ink mb-5 leading-relaxed min-h-[32px]">
                            Running into a bug or a billing issue? Get in touch directly with our engineering and support team.
                        </p>
                        <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                            Contact us <ExternalLink className="w-3 h-3" />
                        </span>
                    </a>
                </div>

                <div className="bg-card border border-line rounded-xl p-6">
                    <h2 className="text-sm font-semibold text-ink mb-6 flex items-center gap-2">
                        <LifeBuoy className="w-4 h-4 text-muted-ink" />
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-[13px] font-medium text-ink mb-1.5 flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-purple-500" />
                                How do I upload custom fonts?
                            </h4>
                            <p className="text-[11px] text-muted-ink leading-relaxed pl-3 border-l-[1.5px] border-line">
                                Presently, custom fonts can be configured through the Brand Kit settings interface. Make sure you are subscribed to a premium tier, then upload your `.ttf` or `.otf` files straight into your brand portfolio.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-[13px] font-medium text-ink mb-1.5 flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                Why is my audio processing taking so long?
                            </h4>
                            <p className="text-[11px] text-muted-ink leading-relaxed pl-3 border-l-[1.5px] border-line">
                                Depending on the length of your original video and server load, audio denoising via our advanced AI models can take up to 30 seconds per minute of video. We actively scale our processing instances during peak usage times.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-[13px] font-medium text-ink mb-1.5 flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-indigo-500" />
                                My captions are cut off at the edges
                            </h4>
                            <p className="text-[11px] text-muted-ink leading-relaxed pl-3 border-l-[1.5px] border-line">
                                Ensure you are using the precise <strong className="text-ink">Aspect Ratio presets</strong> included in the editing suite (e.g. 9:16 for IG Reels/TikTok). The canvas automatically scales the bounding box limits, but extreme font sizes might still push text beyond rendering safe zones.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </AppShell>
    );
}
