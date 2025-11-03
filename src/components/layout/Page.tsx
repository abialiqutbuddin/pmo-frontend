import React from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
};

export const Page: React.FC<Props> = ({ children, className = '' }) => {
  return (
    <div className={`h-full min-h-0 overflow-y-auto p-6 ${className}`}>{children}</div>
  );
};

