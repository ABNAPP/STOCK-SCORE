interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export default function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <header className="text-center mb-8 md:mb-10">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-base sm:text-lg text-gray-500 dark:text-gray-400 font-medium max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </header>
  );
}
