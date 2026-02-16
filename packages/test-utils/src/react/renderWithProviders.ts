import { withTestProviders, type ProviderWrapper } from './withTestProviders';

export interface RenderResultLike {}

export interface RenderFunction<
  TNode,
  TResult extends RenderResultLike,
  TOptions = undefined,
> {
  (ui: TNode, options?: TOptions): TResult;
}

/**
 * 目的: Provider適用と`render`呼び出しを1手順にまとめる。
 * 用途: Reactテストでwrapper組み立てを毎回書かずに、共通レンダリングを実現する。
 */
export function renderWithProviders<
  TNode,
  TResult extends RenderResultLike,
  TOptions = undefined,
>(
  render: RenderFunction<TNode, TResult, TOptions>,
  ui: TNode,
  wrappers: ProviderWrapper<TNode>[] = [],
  options?: TOptions,
): TResult {
  // 実render前にProviderを適用し、各テストのwrapper重複を排除する。
  const applyProviders = withTestProviders(wrappers);
  return render(applyProviders(ui), options);
}
