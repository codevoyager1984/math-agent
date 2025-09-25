import { PreviewMessage, ThinkingMessage } from "./message";
import { Greeting } from "./greeting";
import { memo } from "react";
import type { Vote } from "@/lib/db/schema";
import equal from "fast-deep-equal";
import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { useMessages } from "@/hooks/use-messages";
import type { ChatMessage } from "@/lib/types";
import { useDataStream } from "./data-stream-provider";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./elements/conversation";
import { cn } from "@/lib/utils";

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Array<Vote> | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  isArtifactVisible,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  } = useMessages({
    chatId,
    status,
  });

  useDataStream();

  return (
    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
      <Conversation className="flex flex-col min-w-0 gap-6 pt-4 pb-32 px-4 max-w-4xl mx-auto">
        <ConversationContent className="flex flex-col gap-6">
          {messages.length === 0 && <Greeting />}

          {messages
            .filter((message, index) => {
              // 过滤掉只包含推理内容的助手消息，但仅当下一条消息也包含推理时
              if (message.role === "assistant") {
                const hasOnlyReasoning =
                  message.parts.length === 1 &&
                  message.parts[0].type === "reasoning";

                if (hasOnlyReasoning) {
                  // 检查下一条消息是否存在且也包含推理
                  const nextMessage = messages[index + 1];
                  const nextHasReasoning =
                    nextMessage &&
                    nextMessage.role === "assistant" &&
                    nextMessage.parts.some((part) => part.type === "reasoning");

                  if (nextHasReasoning) {
                    return false;
                  }
                }
              }
              return true;
            })
            .map((message, index) => {
              // console.log("index", index);
              // console.log("message", message);
              return (
                <PreviewMessage
                  key={message.id}
                  chatId={chatId}
                  message={message}
                  isLoading={
                    status === "streaming" && messages.length - 1 === index
                  }
                  vote={
                    votes
                      ? votes.find((vote) => vote.messageId === message.id)
                      : undefined
                  }
                  setMessages={setMessages}
                  regenerate={regenerate}
                  isReadonly={isReadonly}
                  requiresScrollPadding={
                    hasSentMessage && index === messages.length - 1
                  }
                  isArtifactVisible={isArtifactVisible}
                  chatStatus={status}
                />
              );
            })}

          {status === "submitted" &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <ThinkingMessage />
            )}

          <motion.div
            ref={messagesEndRef}
            className="shrink-0 min-w-[24px] min-h-[24px]"
            onViewportLeave={onViewportLeave}
            onViewportEnter={onViewportEnter}
          />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;

  return false;
});
