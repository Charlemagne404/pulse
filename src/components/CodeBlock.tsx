interface CodeBlockProps {
  title: string
  code: string
}

export function CodeBlock({ title, code }: CodeBlockProps) {
  return (
    <div className="code-block">
      <div className="code-block-title">{title}</div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}
