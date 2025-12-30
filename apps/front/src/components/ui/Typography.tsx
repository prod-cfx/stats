'use client';

import React from 'react';

interface TypographyProps {
  children: React.ReactNode;
  className?: string;
}

export const PageTitle = ({ children, className = '' }: TypographyProps) => {
  return (
    <h1 className={`text-h1 font-bold text-white tracking-tight ${className}`}>
      {children}
    </h1>
  );
};

export const SectionTitle = ({ children, className = '' }: TypographyProps) => {
  return (
    <h2 className={`text-h2 font-bold text-white tracking-tight ${className}`}>
      {children}
    </h2>
  );
};

export const SubTitle = ({ children, className = '' }: TypographyProps) => {
  return (
    <h3 className={`text-h3 font-semibold text-white tracking-tight ${className}`}>
      {children}
    </h3>
  );
};

export const BodyText = ({ children, className = '' }: TypographyProps) => {
  return (
    <p className={`text-body text-[#999999] ${className}`}>
      {children}
    </p>
  );
};

export const CaptionText = ({ children, className = '' }: TypographyProps) => {
  return (
    <small className={`text-caption text-[#888888] ${className}`}>
      {children}
    </small>
  );
};

