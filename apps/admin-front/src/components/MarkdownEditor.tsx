'use client'

import type { TextAreaProps } from 'antd/es/input/TextArea'
import type { FC } from 'react'
import {
  BoldOutlined, 
  CodeOutlined, 
  ItalicOutlined, 
  LinkOutlined,
  MinusOutlined,
  OrderedListOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { Button, Input, Space, Tabs, Tooltip } from 'antd'
import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const { TextArea } = Input

type MarkdownEditorProps = Omit<TextAreaProps, 'onChange' | 'value'> & {
  value?: string
  onChange?: (value: string) => void
}

export const MarkdownEditor: FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder,
  rows = 10,
  maxLength,
  showCount,
  ...restProps
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const textAreaRef = useRef<any>(null)
  const isDisabled = restProps.disabled

  // 在光标位置插入文本
  const insertText = (before: string, after: string = '', placeholder: string = '') => {
    const textarea = textAreaRef.current?.resizableTextArea?.textArea
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = (value || '').substring(start, end)
    const textToInsert = selectedText || placeholder
    
    const newText = 
      (value || '').substring(0, start) + 
      before + textToInsert + after + 
      (value || '').substring(end)
    
    onChange?.(newText)

    // 恢复焦点和选择
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + before.length + textToInsert.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const applyPrefixToLines = (prefix: string) => {
    const textarea = textAreaRef.current?.resizableTextArea?.textArea
    if (!textarea) return

    const text = value ?? ''
    const start = textarea.selectionStart ?? 0
    const end = textarea.selectionEnd ?? start
    const startLineIndex = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const endSearchBase = end > 0 ? end - 1 : 0
    const endLineBreakIndex = text.indexOf('\n', endSearchBase)
    const endLineIndex = endLineBreakIndex === -1 ? text.length : endLineBreakIndex

    const segment = text.slice(startLineIndex, endLineIndex)
    const prefixedSegment = segment
      .split('\n')
      .map(line => `${prefix}${line}`)
      .join('\n')

    const newText = text.slice(0, startLineIndex) + prefixedSegment + text.slice(endLineIndex)
    onChange?.(newText)

    setTimeout(() => {
      textarea.focus()
      const newSelectionStart = startLineIndex
      const newSelectionEnd = startLineIndex + prefixedSegment.length
      textarea.setSelectionRange(newSelectionStart, newSelectionEnd)
    }, 0)
  }

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as 'edit' | 'preview')}
        tabBarExtraContent={
          activeTab === 'edit' && (
            <Space size={4} wrap style={{ marginBottom: 8 }}>
              <Tooltip title="标题 1">
                <Button 
                  size="small" 
                  onClick={() => applyPrefixToLines('# ')}
                  style={{ fontSize: 16, fontWeight: 'bold' }}
                  disabled={isDisabled}
                >
                  H1
                </Button>
              </Tooltip>
              <Tooltip title="标题 2">
                <Button 
                  size="small" 
                  onClick={() => applyPrefixToLines('## ')}
                  style={{ fontSize: 14, fontWeight: 'bold' }}
                  disabled={isDisabled}
                >
                  H2
                </Button>
              </Tooltip>
              <Tooltip title="标题 3">
                <Button 
                  size="small" 
                  onClick={() => applyPrefixToLines('### ')}
                  style={{ fontSize: 12, fontWeight: 'bold' }}
                  disabled={isDisabled}
                >
                  H3
                </Button>
              </Tooltip>
              <Tooltip title="粗体">
                <Button 
                  size="small" 
                  icon={<BoldOutlined />}
                  onClick={() => insertText('**', '**', '粗体文本')}
                  disabled={isDisabled}
                />
              </Tooltip>
              <Tooltip title="斜体">
                <Button 
                  size="small" 
                  icon={<ItalicOutlined />}
                  onClick={() => insertText('*', '*', '斜体文本')}
                  disabled={isDisabled}
                />
              </Tooltip>
              <Tooltip title="无序列表">
                <Button 
                  size="small" 
                  icon={<UnorderedListOutlined />}
                  onClick={() => applyPrefixToLines('- ')}
                  disabled={isDisabled}
                />
              </Tooltip>
              <Tooltip title="有序列表">
                <Button 
                  size="small" 
                  icon={<OrderedListOutlined />}
                  onClick={() => applyPrefixToLines('1. ')}
                  disabled={isDisabled}
                />
              </Tooltip>
              <Tooltip title="代码块">
                <Button 
                  size="small" 
                  icon={<CodeOutlined />}
                  onClick={() => insertText('```\n', '\n```', '代码')}
                  disabled={isDisabled}
                />
              </Tooltip>
              <Tooltip title="行内代码">
                <Button 
                  size="small" 
                  onClick={() => insertText('`', '`', '代码')}
                  style={{ fontFamily: 'monospace' }}
                  disabled={isDisabled}
                >
                  {'<>'}
                </Button>
              </Tooltip>
              <Tooltip title="链接">
                <Button 
                  size="small" 
                  icon={<LinkOutlined />}
                  onClick={() => insertText('[', '](url)', '链接文本')}
                  disabled={isDisabled}
                />
              </Tooltip>
              <Tooltip title="表格">
                <Button 
                  size="small" 
                  icon={<TableOutlined />}
                  onClick={() => insertText('\n| 列1 | 列2 |\n|------|------|\n| ', ' | 内容2 |\n', '内容1')}
                  disabled={isDisabled}
                />
              </Tooltip>
              <Tooltip title="分隔线">
                <Button 
                  size="small" 
                  icon={<MinusOutlined />}
                  onClick={() => insertText('\n---\n', '', '')}
                  disabled={isDisabled}
                />
              </Tooltip>
            </Space>
          )
        }
        items={[
          {
            key: 'edit',
            label: '编辑',
            children: (
              <TextArea
                ref={textAreaRef}
                value={value}
                onChange={e => onChange?.(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                maxLength={maxLength}
                showCount={showCount}
                {...restProps}
              />
            ),
          },
          {
            key: 'preview',
            label: '预览',
            children: (
              <div
                style={{
                  minHeight: rows * 22,
                  padding: 12,
                  border: '1px solid rgba(5,5,5,0.06)',
                  borderRadius: 6,
                  background: '#fafafa',
                  overflowX: 'auto',
                  fontSize: 13,
                }}
              >
                {value?.trim() ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // react-markdown 的运行时仍会传 inline 和 node 等字段，这里用 any 解构并显式剔除 node，避免将其透传到 DOM
                      // 同时不把 inline 继续传下去，只在组件内用于判断行内/块级渲染
                      code({ inline, className, children, node: _node, ...rest }: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        if (inline) {
                          return (
                            <code
                              style={{
                                background: 'rgba(0,0,0,0.04)',
                                padding: '0 4px',
                                borderRadius: 4,
                                fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
                              }}
                              {...rest}
                            >
                              {children}
                            </code>
                          )
                        }

                        return (
                          <pre
                            style={{
                              background: '#141414',
                              color: '#f5f5f5',
                              padding: 12,
                              borderRadius: 6,
                              overflowX: 'auto',
                              fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
                            }}
                          >
                            <code className={match ? `language-${match[1]}` : undefined} {...rest}>
                              {children}
                            </code>
                          </pre>
                        )
                      },
                    }}
                  >
                    {value}
                  </ReactMarkdown>
                ) : (
                  <div style={{ color: 'rgba(0,0,0,0.45)' }}>
                    在编辑页签中输入 Markdown 文本，这里将实时展示渲染效果。
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

