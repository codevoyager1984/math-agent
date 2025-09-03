import { copyToClipboard, shortenString } from '@/utils';

export const CopyableText = ({
  text,
  maxWidth,
  elipsis,
}: {
  text?: string;
  maxWidth?: string;
  elipsis?: boolean;
}) => {
  maxWidth = maxWidth || '100px';
  return (
    <span
      style={{
        maxWidth: maxWidth,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxLines: 1,
        whiteSpace: 'nowrap',
        display: 'inline-block',
        cursor: 'pointer',
      }}
      onClick={() => {
        if (text) {
          copyToClipboard(text);
        }
      }}
    >
      {text ? (elipsis ? shortenString(text) : text) : '-'}
    </span>
  );
};
