'use client';

import React from 'react';

interface TypographyProps {
  children: React.ReactNode;
  className?: string;
}

export const PageTitle = ({ children, className = '' }: TypographyProps) => {
  return (
    <h1 className={`!text-base !font-semibold !leading-6 text-[color:var(--cf-text-strong)] ${className}`}>
      {children}
    </h1>
  );
};

export const SectionTitle = ({ children, className = '' }: TypographyProps) => {
  return (
    <h2 className={`!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)] ${className}`}>
      {children}
    </h2>
  );
};

export const SubTitle = ({ children, className = '' }: TypographyProps) => {
  return (
    <h3 className={`!text-[15px] !font-semibold !leading-[22px] text-[color:var(--cf-text-strong)] ${className}`}>
      {children}
    </h3>
  );
};

export const BodyText = ({ children, className = '' }: TypographyProps) => {
  return (
    <p className={`!text-sm !font-normal !leading-[22px] text-[color:var(--cf-muted)] ${className}`}>
      {children}
    </p>
  );
};

export const CaptionText = ({ children, className = '' }: TypographyProps) => {
  return (
    <small className={`!text-xs !font-normal !leading-5 text-[color:var(--cf-muted)] ${className}`}>
      {children}
    </small>
  );
};
