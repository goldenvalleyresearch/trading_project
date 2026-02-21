// new-frontend/src/componets/Sections/Performance/PerformanceHero/PerformanceHero.tsx
import styles from "./PerformanceHero.module.css";

type Props = {
  title?: string;
  lede?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export default function PerformanceHero({
  title = "Performance"
  
}: Props) {
  return (
    <section className={styles.top}>
      <div>
        <h1 className={styles.h1}>{title}</h1>
      </div>

      <div className={styles.topActions}>
        
        
      </div>
    </section>
  );
}