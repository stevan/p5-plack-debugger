package Plack::Debugger::Panel::ModuleVersions;

use strict;
use warnings;

use Module::Versions;

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'}     ||= 'Module Versions';
    $args{'formatter'} ||= 'ordered_key_value_pairs';

    $args{'after'} = sub {
        my ($self, $env, $resp) = @_;
        my $modules = Module::Versions->HASH;
        $self->set_result([
            map { 
                $_ => $modules->{ $_ }->{'VERSION'} 
            } sort keys %$modules
        ]);
    };

    $class->SUPER::new( \%args );
}

1;

__END__

=pod

=head1 NAME

Plack::Debugger::Panel::ModuleVersions - Debug panel for inspecting Perl module versions

=head1 DESCRIPTION

=head1 ACKNOWLEDGEMENTS

Thanks to Booking.com for sponsoring the writing of this module.

=cut