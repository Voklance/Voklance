import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { authApi } from '../api/authApi';
import { currentUserKey, prepareAuthenticatedCache } from '../cache/authCache';

type Mode = 'login' | 'signup';
type Field = 'name' | 'email' | 'password' | 'confirmPassword';
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;
const emptyValues: Values = { name: '', email: '', password: '', confirmPassword: '' };

function validate(mode: Mode, values: Values): Errors {
  const errors: Errors = {};
  if (mode === 'signup' && values.name.trim().length < 2) errors.name = 'Enter at least 2 characters.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (!values.password) errors.password = 'Enter your password.';
  else if (mode === 'signup' && values.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (mode === 'signup' && values.confirmPassword !== values.password)
    errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const isSignup = mode === 'signup';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Values>(emptyValues);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const errors = validate(mode, values);
  const mutation = useMutation({
    mutationFn: async () => {
      let verificationEmailSent: boolean | undefined;
      if (isSignup)
        verificationEmailSent = (
          await authApi.signup({
            name: values.name.trim(),
            email: values.email.trim(),
            password: values.password
          })
        ).verificationEmailSent;
      else await authApi.login({ email: values.email.trim(), password: values.password });
      await prepareAuthenticatedCache(queryClient);
      const current = await authApi.currentUser();
      if (!current) throw new Error('Your session could not be confirmed. Please try again.');
      return { current, verificationEmailSent };
    },
    onSuccess({ current: user, verificationEmailSent }) {
      queryClient.setQueryData(currentUserKey, user);
      navigate(
        user.emailVerificationRequired && !user.emailVerifiedAt
          ? '/verify-email-required'
          : user.onboardingStatus === 'COMPLETED'
            ? '/app'
            : '/onboarding',
        { replace: true, state: { verificationEmailSent } }
      );
    }
  });

  function update(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (mutation.isError) mutation.reset();
  }

  function touch(field: Field) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ name: true, email: true, password: true, confirmPassword: true });
    if (!Object.keys(errors).length) mutation.mutate();
  }

  return (
    <section aria-labelledby="form-title">
      <h2 id="form-title">{isSignup ? 'Join Voklance.' : 'Welcome back.'}</h2>
      <p className="form-intro">
        {isSignup
          ? 'Create an account for a network built around professional communities.'
          : 'Sign in to your professional network and communities.'}
      </p>
      {mutation.isError && (
        <p className="form-alert" role="alert">
          {apiErrorMessage(mutation.error)}
        </p>
      )}
      <form onSubmit={submit} noValidate>
        {isSignup && (
          <div className="field">
            <label htmlFor="name">
              Full name <span>Required</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={values.name}
              onChange={(event) => update('name', event.target.value)}
              onBlur={() => touch('name')}
              aria-invalid={touched.name && !!errors.name}
              aria-describedby="name-help"
              required
              maxLength={80}
            />
            <p className={touched.name && errors.name ? 'field-help error' : 'field-help'} id="name-help">
              {touched.name && errors.name ? errors.name : ' '}
            </p>
          </div>
        )}
        <div className="field">
          <label htmlFor="email">
            Email address <span>Required</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => update('email', event.target.value)}
            onBlur={() => touch('email')}
            aria-invalid={touched.email && !!errors.email}
            aria-describedby="email-help"
            required
            maxLength={254}
          />
          <p className={touched.email && errors.email ? 'field-help error' : 'field-help'} id="email-help">
            {touched.email && errors.email ? errors.email : ' '}
          </p>
        </div>
        <div className="field">
          <label htmlFor="password">
            Password <span>Required</span>
          </label>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={values.password}
              onChange={(event) => update('password', event.target.value)}
              onBlur={() => touch('password')}
              aria-invalid={touched.password && !!errors.password}
              aria-describedby="password-help"
              required
              minLength={isSignup ? 8 : undefined}
              maxLength={128}
            />
            <button
              type="button"
              className="reveal-button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <p
            className={touched.password && errors.password ? 'field-help error' : 'field-help'}
            id="password-help"
          >
            {touched.password && errors.password
              ? errors.password
              : isSignup
                ? 'Use at least 8 characters.'
                : ' '}
          </p>
        </div>
        {isSignup && (
          <div className="field">
            <label htmlFor="confirm-password">
              Confirm password <span>Required</span>
            </label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={(event) => update('confirmPassword', event.target.value)}
              onBlur={() => touch('confirmPassword')}
              aria-invalid={touched.confirmPassword && !!errors.confirmPassword}
              aria-describedby="confirm-help"
              required
              maxLength={128}
            />
            <p
              className={
                touched.confirmPassword && errors.confirmPassword ? 'field-help error' : 'field-help'
              }
              id="confirm-help"
            >
              {touched.confirmPassword && errors.confirmPassword ? errors.confirmPassword : ' '}
            </p>
          </div>
        )}
        <button className="submit-button" type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? isSignup
              ? 'Creating account…'
              : 'Signing in…'
            : isSignup
              ? 'Create account'
              : 'Sign in'}
        </button>
      </form>
      <p className="switch-view">
        {isSignup ? 'Already have an account?' : 'New to Voklance?'}{' '}
        <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create an account'}</Link>
      </p>
    </section>
  );
}
