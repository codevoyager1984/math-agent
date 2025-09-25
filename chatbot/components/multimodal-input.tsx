"use client";

import type { UIMessage } from "ai";
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";

import { ArrowUpIcon, PaperclipIcon, StopIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { Button } from "./ui/button";
import { Loader } from "./elements/loader";
import { SuggestedActions } from "./suggested-actions";
import { useTranslation } from "react-i18next";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from "./elements/prompt-input";
import equal from "fast-deep-equal";
import type { UseChatHelpers } from "@ai-sdk/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import type { VisibilityType } from "./visibility-selector";
import type { Attachment, ChatMessage } from "@/lib/types";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { startTransition } from "react";

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  selectedModelId,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
}) {
  const [isDeepThinking, setIsDeepThinking] = useState(
    selectedModelId === "chat-model-reasoning"
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLFormElement>(null);
  const { width } = useWindowSize();
  const { t } = useTranslation();
  const [inputContainerHeight, setInputContainerHeight] = useState(0);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  // Monitor input container height changes
  useEffect(() => {
    if (!inputContainerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        setInputContainerHeight(height);
      }
    });

    resizeObserver.observe(inputContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${
        textareaRef.current.scrollHeight + 2
      }px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = "98px";
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);
  const [ocrInProgress, setOcrInProgress] = useState<boolean>(false);

  // Check if any image attachments are still processing OCR
  const hasOcrInProgress = useCallback(() => {
    return attachments.some(
      (attachment) =>
        attachment.contentType.startsWith("image/") && attachment.ocrLoading
    );
  }, [attachments]);

  const submitForm = useCallback(() => {
    // Prevent submission if any OCR is still in progress
    if (hasOcrInProgress()) {
      toast.error(t("chat.waitForOcrCompletion"));
      return;
    }

    // Collect OCR text from image attachments
    const ocrTexts = attachments
      .filter(
        (attachment) =>
          attachment.contentType.startsWith("image/") && attachment.ocrText
      )
      .map((attachment) => `[图片识别结果]: \n ${attachment.ocrText}`)
      .join("\n");

    // Combine input text with OCR results
    const fullText = [input, ocrTexts].filter(Boolean).join("\n\n");

    // Check if there's any meaningful content to send
    if (!fullText.trim() && attachments.length === 0) {
      toast.error(t("chat.emptyMessage"));
      return;
    }

    window.history.replaceState({}, "", `/chat/${chatId}`);

    sendMessage({
      role: "user",
      parts: [
        ...attachments.map((attachment) => ({
          type: "file" as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: "text",
          text: fullText,
        },
      ],
    });

    setAttachments([]);
    setLocalStorageInput("");
    resetHeight();
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    hasOcrInProgress,
    t,
  ]);

  const performOCR = async (imageUrl: string, attachment: Attachment) => {
    // Set global OCR loading state
    setOcrInProgress(true);

    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update attachment with OCR result
          setAttachments((current) =>
            current.map((a) =>
              a.url === attachment.url
                ? { ...a, ocrText: data.text, ocrLoading: false }
                : a
            )
          );
          toast.success(t("attachments.ocrCompleted"));
        } else {
          throw new Error(data.error || t("errors.ocrFailed"));
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || t("errors.ocrRequestFailed"));
      }
    } catch (error) {
      console.error("OCR error:", error);
      // Remove loading state on error
      setAttachments((current) =>
        current.map((a) =>
          a.url === attachment.url ? { ...a, ocrLoading: false } : a
        )
      );
      toast.error(t("attachments.ocrFailed"));
    } finally {
      // Always clear global OCR loading state
      setOcrInProgress(false);
    }
  };

  const uploadFile = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          const { url, pathname, contentType } = data;

          const attachment = {
            url,
            name: pathname,
            contentType: contentType,
            // For images, initialize with ocrLoading: true
            ...(contentType.startsWith("image/") && { ocrLoading: true }),
          };

          // If it's an image, trigger OCR
          if (contentType.startsWith("image/")) {
            performOCR(url, attachment);
          }

          return attachment;
        }
        const { error } = await response.json();
        toast.error(error);
      } catch (error) {
        toast.error(t("errors.uploadFailed"));
      }
    },
    [t, performOCR]
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      await handleFiles(files);
    },
    [handleFiles]
  );

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(event.clipboardData.items);
      const files = items
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (files.length > 0) {
        event.preventDefault();
        const fileCount = files.length;
        const fileText = fileCount === 1 ? "file" : "files";
        toast.success(t("attachments.uploadingFiles", { count: fileCount }));
        await handleFiles(files);
      }
    },
    [handleFiles, t]
  );

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  useEffect(() => {
    if (status === "submitted") {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  return (
    <div className="flex relative flex-col gap-4 w-full">
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute left-1/2 z-50 -translate-x-1/2"
            style={{
              bottom: `${Math.max(inputContainerHeight + 16, 112)}px`, // 16px gap + fallback to 112px (28*4)
            }}
          >
            <Button
              data-testid="scroll-to-bottom-button"
              className="rounded-full"
              size="icon"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                scrollToBottom();
              }}
            >
              <ArrowDown />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            sendMessage={sendMessage}
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}

      {/* Global OCR Progress Bar */}
      {/* {(ocrInProgress || hasOcrInProgress()) && (
        <div className="w-full max-w-2xl mx-auto mb-4">
          <div className="bg-muted rounded-lg p-3 border border-orange-300 dark:border-orange-600">
            <div className="flex items-center gap-3">
              <Loader size={20} />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{t('attachments.ocrInProgress')}</div>
                <div className="text-xs text-muted-foreground">{t('attachments.ocrInProgressDescription')}</div>
              </div>
            </div>
            <div className="mt-2 w-full bg-background rounded-full h-1.5">
              <div className="bg-orange-500 h-1.5 rounded-full animate-pulse" style={{ width: '70%' }}></div>
            </div>
          </div>
        </div>
      )} */}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      <PromptInput
        ref={inputContainerRef}
        className={`border transition-all duration-200 shadow-lg shadow-black/10 ${
          ocrInProgress || hasOcrInProgress()
            ? "border-orange-300 bg-orange-50/20 dark:bg-orange-950/20 dark:border-orange-600"
            : "border-transparent hover:border-primary/20 focus-within:border-primary/30 focus-within:shadow-xl focus-within:shadow-primary/20"
        }`}
        onSubmit={(event) => {
          event.preventDefault();
          if (status !== "ready") {
            toast.error(t("chat.waitForModelResponse"));
          } else if (uploadQueue.length > 0) {
            toast.error(t("chat.waitForFileUpload"));
          } else if (ocrInProgress || hasOcrInProgress()) {
            toast.error(t("chat.waitForOcrCompletion"));
          } else {
            submitForm();
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div className="px-3 py-2">
            <div
              data-testid="attachments-preview"
              className="flex overflow-x-scroll flex-row gap-2 items-end"
            >
              {attachments.map((attachment) => (
                <PreviewAttachment
                  key={attachment.url}
                  attachment={attachment}
                  isUploading={uploadQueue.includes(attachment.name)}
                  onRemove={() => {
                    setAttachments((currentAttachments) =>
                      currentAttachments.filter(
                        (a) => a.url !== attachment.url
                      )
                    );
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  onOcrTextChange={(newText) => {
                    setAttachments((currentAttachments) =>
                      currentAttachments.map((a) =>
                        a.url === attachment.url
                          ? { ...a, ocrText: newText }
                          : a
                      )
                    );
                  }}
                />
              ))}

              {uploadQueue.map((filename) => (
                <PreviewAttachment
                  key={filename}
                  attachment={{
                    url: "",
                    name: filename,
                    contentType: "",
                  }}
                  isUploading={true}
                />
              ))}
            </div>

            {/* Global OCR Progress Indicator */}
            {/* {(ocrInProgress || hasOcrInProgress()) && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader size={16} />
                <span>{t('attachments.ocrInProgressShort')}</span>
              </div>
            )} */}
          </div>
        )}

        <PromptInputTextarea
          data-testid="multimodal-input"
          ref={textareaRef}
          placeholder={
            ocrInProgress || hasOcrInProgress()
              ? t("chat.ocrInProgressPlaceholder")
              : t("chat.sendMessagePlaceholder")
          }
          value={input}
          onChange={handleInput}
          onPaste={handlePaste}
          minHeight={48}
          maxHeight={48}
          disableAutoResize={true}
          style={{ height: "48px", minHeight: "48px", maxHeight: "48px" }}
          className="text-sm resize-none py-1 px-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          rows={1}
          autoFocus
        />
        <PromptInputToolbar className="px-2 py-1">
          <PromptInputTools className="gap-2">
            <AttachmentsButton
              fileInputRef={fileInputRef}
              status={status}
              ocrInProgress={ocrInProgress || hasOcrInProgress()}
            />
            <DeepThinkingToggle
              isDeepThinking={isDeepThinking}
              onToggle={(enabled) => {
                setIsDeepThinking(enabled);
                const modelId = enabled ? "chat-model-reasoning" : "chat-model";
                startTransition(() => {
                  saveChatModelAsCookie(modelId);
                });
              }}
            />
          </PromptInputTools>
          {status !== "ready" ? (
            <StopButton stop={stop} setMessages={setMessages} />
          ) : (
            <PromptInputSubmit
              status={status}
              disabled={
                (!input.trim() && attachments.length === 0) ||
                uploadQueue.length > 0 ||
                ocrInProgress ||
                hasOcrInProgress()
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground size-8"
              size="sm"
            />
          )}
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;
    if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;

    return true;
  }
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  ocrInProgress = false,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  ocrInProgress?: boolean;
}) {
  return (
    <Button
      type="button"
      data-testid="attachments-button"
      className="rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={status !== "ready" || ocrInProgress}
      variant="ghost"
    >
      <PaperclipIcon size={14} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureDeepThinkingToggle({
  isDeepThinking,
  onToggle,
}: {
  isDeepThinking: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`text-xs h-7 px-3 rounded-full border transition-all duration-200 font-medium ${
        isDeepThinking
          ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600 shadow-md scale-105"
          : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20"
      }`}
      onClick={() => onToggle(!isDeepThinking)}
      title={t("chat.deepThinkingDescription")}
    >
      <span
        className={`mr-1.5 transition-transform duration-200 ${
          isDeepThinking ? "scale-110" : ""
        }`}
      >
        🧠
      </span>
      {t("chat.deepThinking")}
    </Button>
  );
}

const DeepThinkingToggle = memo(PureDeepThinkingToggle);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      data-testid="stop-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950 dark:hover:border-red-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
        toast.success(t("chat.responseStopped"));
      }}
      title={t("chat.stopGeneration")}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
  attachments,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
  attachments: Array<Attachment>;
}) {
  return (
    <Button
      data-testid="send-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={
        (input.length === 0 && attachments.length === 0) ||
        uploadQueue.length > 0
      }
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  if (!equal(prevProps.attachments, nextProps.attachments)) return false;
  return true;
});
