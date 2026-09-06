package com.samtracker.auth;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class CredentialDetailsService implements UserDetailsService {

    private final CredentialRepository credentialRepository;

    public CredentialDetailsService(CredentialRepository credentialRepository) {
        this.credentialRepository = credentialRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return credentialRepository.findByUsername(username)
                .map(c -> User.withUsername(c.getUsername())
                        .password(c.getPasswordHash())
                        .roles(c.getRole())
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    }
}
