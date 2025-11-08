// Temporary ambient typings to satisfy TS until deps are installed
declare module 'react-markdown' {
  import * as React from 'react';
  type Props = {
    children?: React.ReactNode;
    className?: string;
    remarkPlugins?: any[];
  } & React.HTMLAttributes<HTMLDivElement>;
  const ReactMarkdown: React.ComponentType<Props>;
  export default ReactMarkdown;
}

declare module 'remark-gfm' {
  const remarkGfm: any;
  export default remarkGfm;
}

