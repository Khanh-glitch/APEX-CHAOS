// Compiled to tools/pressure-solver-wasm.generated.mjs base64 bytes.
// Rebuild: clang -target wasm32 -O3 -fno-fast-math -ffp-contract=off -nostdlib
//   -Wl,--no-entry -Wl,--import-memory -Wl,--export=project pressure-solver.c -o pressure.wasm
// Semantic goal: bitwise-equal float32 stores to Gold Fluid.project(); 14 Gauss-Seidel sweeps.
__attribute__((export_name("project")))
void project(int n,int i0,int i1,int j0,int j1,int uoff,int voff,int poff,int divoff){
float *u=(float*)(__UINTPTR_TYPE__)uoff,*v=(float*)(__UINTPTR_TYPE__)voff,*p=(float*)(__UINTPTR_TYPE__)poff,*div=(float*)(__UINTPTR_TYPE__)divoff;
for(int j=j0;j<=j1;j++)for(int i=i0;i<=i1;i++){int idx=j*n+i;div[idx]=(float)(-0.5*((double)u[idx+1]-(double)u[idx-1]+(double)v[idx+n]-(double)v[idx-n]));p[idx]=0;}
for(int k=0;k<14;k++)for(int j=j0;j<=j1;j++)for(int i=i0;i<=i1;i++){int idx=j*n+i;p[idx]=(float)(((double)div[idx]+(double)p[idx-1]+(double)p[idx+1]+(double)p[idx-n]+(double)p[idx+n])*0.25);}
for(int j=j0;j<=j1;j++)for(int i=i0;i<=i1;i++){int idx=j*n+i;u[idx]=(float)((double)u[idx]-0.5*((double)p[idx+1]-(double)p[idx-1]));v[idx]=(float)((double)v[idx]-0.5*((double)p[idx+n]-(double)p[idx-n]));}
}
