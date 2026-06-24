"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchableSelectProps {
  id: string
  label: string
  required?: boolean
  placeholder?: string
  value: string
  onChange: (value: string, id: string) => void
  options: Array<{ id: string; name: string; [key: string]: any }>
  loading?: boolean
  searchable?: boolean
  displayKey?: string // 使用哪个字段作为显示文本
}

export function SearchableSelect({
  id,
  label,
  required = false,
  placeholder = "请搜索...",
  value,
  onChange,
  options,
  loading = false,
  searchable = true,
  displayKey = "name",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 找到当前选中项
  const selectedOption = options.find((opt) => opt.id === value)

  // 计算输入框应该显示的值
  const inputValue = isOpen ? searchTerm : (selectedOption?.[displayKey] || "")

  // 过滤选项
  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt[displayKey]?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options

  // 计算下拉列表位置
  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }

  // 点击外部关闭下拉（使用 Portal 容器的引用来检测）
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      // 检查点击是否在 containerRef 内（输入框）
      const inContainer = containerRef.current?.contains(target)
      // 检查点击是否在 Portal 元素内（下拉列表）
      // 通过检查是否有 data-option-id 属性来判断
      const isDropdownOption = (target as HTMLElement)?.closest?.('[data-option-id]')

      // 如果既不在容器内，也不是下拉选项，才关闭
      if (!inContainer && !isDropdownOption) {
        setIsOpen(false)
        setSearchTerm("") // 关闭时清空搜索词
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // 当打开时更新位置
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition()
      // 监听滚动和窗口大小变化
      window.addEventListener('scroll', updateDropdownPosition, true)
      window.addEventListener('resize', updateDropdownPosition)

      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true)
        window.removeEventListener('resize', updateDropdownPosition)
      }
    }
  }, [isOpen])

  const handleSelect = (option: { id: string; [key: string]: any }) => {
    onChange(option.id, option[displayKey])
    setSearchTerm("")
    setIsOpen(false)
  }

  // Use onMouseUp instead of onClick for better reliability with Portal
  // This fires before the click event and won't be affected by DOM changes
  const handleItemInteraction = (option: { id: string; [key: string]: any }) => {
    handleSelect(option)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    setIsOpen(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (isOpen) {
        e.preventDefault()
        if (filteredOptions.length === 1) {
          handleSelect(filteredOptions[0])
        }
      }
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchTerm("")
    }
  }

  const handleFocus = () => {
    setIsOpen(true)
    updateDropdownPosition()
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="pr-8"
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {selectedOption && !isOpen && (
          <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
        )}
      </div>

      {isOpen && (filteredOptions.length > 0 || searchTerm) && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-50 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
          >
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                加载中...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                未找到匹配项
              </div>
            ) : (
              <ul className="py-1">
                {filteredOptions.map((option) => (
                  <li
                    key={option.id}
                    data-option-id={option.id}
                    onMouseUp={() => handleItemInteraction(option)}
                    className={cn(
                      "px-4 py-2 cursor-pointer hover:bg-muted transition-colors",
                      option.id === value && "bg-accent"
                    )}
                  >
                    {option[displayKey]}
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
