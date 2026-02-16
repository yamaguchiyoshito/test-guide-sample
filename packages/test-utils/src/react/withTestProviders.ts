export interface ProviderWrapper<TNode> {
  (node: TNode): TNode;
}

/**
 * 目的: 複数Providerラッパを1つのwrapper関数へ合成する。
 * 用途: `QueryClientProvider` などをネスト順を保ってまとめる時に使う。
 */
export function withTestProviders<TNode>(
  wrappers: ProviderWrapper<TNode>[],
): ProviderWrapper<TNode> {
  return (node: TNode) => {
    // Reactのwrapper入れ子順に合わせて、右から左へ合成する。
    return wrappers.reduceRight((currentNode, wrap) => wrap(currentNode), node);
  };
}
