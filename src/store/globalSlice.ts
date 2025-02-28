import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '.'

interface GlobalStateProps {
  language: 'zh' | 'en' | 'ja'
}

export const globalStateSlice = createSlice({
  name: 'global',
  initialState: {
    language: 'zh'
  } as GlobalStateProps,
  reducers: {
    setGlobalState: (
      state: GlobalStateProps,
      action: PayloadAction<{
        [key in keyof GlobalStateProps]?: GlobalStateProps[key]
      }>
    ) => {
      for (const [key, value] of Object.entries(action.payload)) {
        if (value !== undefined) {
          // @ts-ignore
          state[key] = value;
        }
      }
    }
  }
})

export const { setGlobalState } = globalStateSlice.actions
export const selectGlobal = (state: RootState) => state.global
export default globalStateSlice.reducer
