'use client';

import { useRef, useState, useEffect } from 'react';
import Navigation from '@/app/Navigation';
import AnimatedBackground from '@/app/AnimatedBackground';

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.unobserve(entry.target); } },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function AnimatedElement({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} style={{ opacity: inView ? 1 : 0, animation: inView ? `fadeInUp 0.6s ease-out forwards` : 'none', animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

const chapters = [
  { chapter: 'Chapter 1: The Bucketlist', text: "The series begins with Pat discovering a mysterious, magical pocketwatch that serves as a tether between realities. During a sudden portal opening, Pat is pulled into a dark dimension known as the Theaneb, where he encounters Kasey Heffley. Trapped within this void, Kasey attempts to seize the watch to fuel her escape, leading to a high-stakes confrontation. Pat manages to overcome her and return to his own reality, but his sudden disappearance and lack of explanation leave his friend Sarah feeling deeply betrayed, straining the team's dynamic from the very start." },
  { chapter: 'Chapter 2: A Tale Of Incidents', text: "Hoping to extend his summer and unravel the mysteries of the previous encounter, Pat finds himself drawn back into the interdimensional void. He seeks out Kasey, offering to hand over the pocketwatch in exchange for a way to manipulate time and save the summer. However, the deal collapses when Pat realizes Kasey's true intentions: she plans to use the artifact to stage a global takeover once she is freed. A fierce battle ensues throughout the dimension until both are forcibly ejected back into the present day, leaving the fate of the watch and the world hanging in the balance." },
  { chapter: 'Chapter 3: Back To Reality', text: "As summer draws to a close, the missing pocketwatch falls into the hands of a mysterious neighbor revealed to be Mark Heffley, the father of Kasey. Unaware of the danger, Pat, Sarah, and Matthew board a train to leave Montreal for their respective home cities. The departure is interrupted when Kasey ambushes the train, terrorizing the teenagers in a desperate search for the watch they no longer possess. Just as the situation turns dire, a new player named Valentina Venezetti—Kasey's estranged childhood best friend—intervenes and portals Kasey back into the Theaneb. The trio returns to Montreal only to find their base of operations engulfed in a devastating fire." },
  { chapter: 'Chapter 4: A Fading Shamrock', text: "Trapped within the burning building, the team escapes through the vents into a secret underground bunker. They discover the StarGazer, a top-secret portal machine developed by Mark Heffley to secure a Nobel Prize and immense wealth. As Valentina and her robotic sidekick Velma monitor the machine's power, it is revealed that Mark intentionally trapped his own daughter in the Theaneb. This betrayal causes his bodyguard, Michael McCallister, to rebel, prematurely activating the StarGazer without the necessary stabilizing substances. The resulting imbalance causes the machine to implode, creating a localized black hole that emits purple radiation, contaminating Montreal's vegetation. In the chaos, Kasey returns and turns against her father after learning the truth. Mark destroys the magical pocketwatch and flees the scene after a final standoff with the teenagers and arriving authorities. The chapter ends on a somber note as the friends share a gloomy farewell, only for Pat to see a news report on the fire's victims that compels him to return to Montreal, setting the stage for Phase 2." },
];

export default function AboutPage() {
  return (
    <main>
      <AnimatedBackground />
      <Navigation />
      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <section style={{ padding: '140px 20px 100px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <AnimatedElement>
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '16px', textTransform: 'uppercase' }}>The Series</span>
            <h1 style={{ fontSize: 'clamp(36px, 5vw, 64px)', fontFamily: 'var(--font-display)', fontWeight: '700', background: 'linear-gradient(135deg, #4ade80 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '32px' }}>
              About Clover Chaos
            </h1>
            <p style={{ color: '#cbd5e1', fontSize: '16px', lineHeight: '1.9', marginBottom: '16px' }}>
              Clover Chaos is an independent animated web series by Clover Animations that transforms the familiar streets of 2018 Montreal into a surreal playground for interdimensional mystery and dark satire. The story follows a teenager named Pat and his small team of friends who find themselves in the middle of a citywide crisis during what should have been a standard summer break. Their journey quickly escalates as they are pursued by a calculating mastermind known as the Father and a powerful interdimensional entity whose arrival threatens the fabric of their reality. Combining a "cute but intense" aesthetic with high-energy action, the show balances its lighthearted, comic-inspired visuals against a deeply layered narrative full of hidden lore and high stakes.
            </p>
            <p style={{ color: '#cbd5e1', fontSize: '16px', lineHeight: '1.9' }}>
              The series is built on a cinematic foundation, utilizing driving rhythms and dramatic vocal swells to highlight its most pivotal moments. As the characters navigate their stylized urban environment, the show explores themes of resilience and the consequences of meddling with forces beyond human understanding. With Phase 1 establishing the core conflict between the trio and the Father's erratic schemes, the story has since expanded into Phase 2, offering a more complex look at the origins of the chaos and the true nature of the beings haunting Montreal. By blending relatable teenage dynamics with large-scale supernatural events, Clover Chaos has carved out a unique space in the indie animation scene as a project that is as visually polished as it is narratively ambitious.
            </p>
          </AnimatedElement>

          <AnimatedElement delay={0.1}>
            <div style={{ borderTop: '1px solid rgba(74, 222, 128, 0.2)', paddingTop: '48px', marginTop: '48px' }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '32px', textTransform: 'uppercase' }}>Summary</span>
              {chapters.map((item, idx) => (
                <AnimatedElement key={idx} delay={idx * 0.1}>
                  <div style={{ marginBottom: '40px', paddingLeft: '20px', borderLeft: '2px solid rgba(74, 222, 128, 0.3)' }}>
                    <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80', marginBottom: '12px' }}>{item.chapter}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.9' }}>{item.text}</p>
                  </div>
                </AnimatedElement>
              ))}
            </div>
          </AnimatedElement>
        </div>
      </section>
    </main>
  );
}
